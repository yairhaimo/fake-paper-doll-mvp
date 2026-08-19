import { getFrame } from './canonicalBody';
import { DEFAULT_CHARACTER_CATALOG, SHARED_PALETTE } from './registries';
import {
  SEMANTIC_LAYERS,
  type AnimationId,
  type AppearanceSelection,
  type CharacterCatalog,
  type CompositionResult,
  type DrawCommand,
  type EquipmentDefinition,
  type Facing,
  type IdentityDefinition,
  type LayerPieceMap,
  type PaletteDefinition,
  type PieceProviderKind,
  type SemanticLayer,
} from './types';
import type { AnimationPlayerSnapshot } from './animationPlayer';

export interface CompositionRequest {
  readonly appearance: AppearanceSelection;
  readonly animationId: AnimationId;
  readonly frameIndex: number;
  readonly facing?: Facing;
}

interface ResolvedPiece {
  readonly assetId: string;
  readonly providerKind: PieceProviderKind;
  readonly providerId: string;
}

export class CompositionError extends Error {
  readonly code: string;
  readonly context: Readonly<Record<string, string | number>>;

  constructor(
    code: string,
    message: string,
    context: Readonly<Record<string, string | number>> = {},
  ) {
    super(message);
    this.name = 'CompositionError';
    this.code = code;
    this.context = Object.freeze({ ...context });
  }
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function orderedLayers(layers: ReadonlySet<SemanticLayer>): SemanticLayer[] {
  return SEMANTIC_LAYERS.filter((layer) => layers.has(layer));
}

function requireRegistryEntry<T>(
  registry: ReadonlyMap<string, T>,
  id: string,
  kind: string,
): T {
  const value = registry.get(id);
  if (value === undefined) {
    throw new CompositionError(
      `UNKNOWN_${kind.toUpperCase()}`,
      `Unknown ${kind} ID: ${id}`,
      { id },
    );
  }
  return value;
}

function requirePieceSet(
  definition: IdentityDefinition | EquipmentDefinition,
  animationId: AnimationId,
  frameIndex: number,
): LayerPieceMap {
  if (!definition.animationCoverage.includes(animationId)) {
    throw new CompositionError(
      'UNSUPPORTED_ANIMATION',
      `${definition.slot} ${definition.id} does not support ${animationId}`,
      { providerId: definition.id, animationId },
    );
  }
  const pieceSet = definition.pieces[animationId][frameIndex];
  if (pieceSet === undefined) {
    throw new CompositionError(
      'MISSING_FRAME_COVERAGE',
      `${definition.slot} ${definition.id} has no pieces for ${animationId} frame ${frameIndex}`,
      { providerId: definition.id, animationId, frameIndex },
    );
  }
  return pieceSet;
}

function applyIdentity(
  target: Map<SemanticLayer, ResolvedPiece>,
  identity: IdentityDefinition,
  pieces: LayerPieceMap,
): void {
  for (const layer of SEMANTIC_LAYERS) {
    const assetId = pieces[layer];
    if (assetId === undefined) continue;
    target.set(layer, {
      assetId,
      providerKind: 'identity',
      providerId: identity.id,
    });
  }
}

function applyEquipment(
  target: Map<SemanticLayer, ResolvedPiece>,
  definition: EquipmentDefinition,
  pieces: LayerPieceMap,
  hidden: Set<SemanticLayer>,
  replaced: Set<SemanticLayer>,
): void {
  for (const layer of definition.hideLayers) {
    if (target.delete(layer)) hidden.add(layer);
  }

  for (const layer of SEMANTIC_LAYERS) {
    const assetId = pieces[layer];
    if (assetId === undefined) continue;
    const existing = target.get(layer);
    if (existing !== undefined && !definition.replaceLayers.includes(layer)) {
      throw new CompositionError(
        'IMPLICIT_LAYER_COLLISION',
        `${definition.slot} ${definition.id} provides occupied layer ${layer} without an explicit replace rule`,
        { providerId: definition.id, layer },
      );
    }
    if (existing !== undefined) replaced.add(layer);
    target.set(layer, {
      assetId,
      providerKind: definition.slot,
      providerId: definition.id,
    });
  }
}

/**
 * Pure, deterministic semantic compositor. It resolves what should be drawn;
 * renderer-specific texture creation remains outside this package.
 */
export class CompositionResolver {
  readonly catalog: CharacterCatalog;

  constructor(catalog: CharacterCatalog = DEFAULT_CHARACTER_CATALOG) {
    this.catalog = catalog;
  }

  resolve(request: CompositionRequest): CompositionResult {
    const facing = request.facing ?? 1;
    if (facing !== -1 && facing !== 1) {
      throw new CompositionError('INVALID_FACING', 'Facing must be -1 or 1');
    }

    const frame = getFrame(request.animationId, request.frameIndex);
    const identity = requireRegistryEntry(
      this.catalog.identities,
      request.appearance.identityId,
      'identity',
    );
    const outfit = requireRegistryEntry(
      this.catalog.outfits,
      request.appearance.outfitId,
      'outfit',
    );
    const weapon =
      request.appearance.weaponId === null
        ? null
        : requireRegistryEntry(
            this.catalog.weapons,
            request.appearance.weaponId,
            'weapon',
          );

    const resolved = new Map<SemanticLayer, ResolvedPiece>();
    const hidden = new Set<SemanticLayer>();
    const replaced = new Set<SemanticLayer>();

    applyIdentity(
      resolved,
      identity,
      requirePieceSet(identity, request.animationId, request.frameIndex),
    );
    applyEquipment(
      resolved,
      outfit,
      requirePieceSet(outfit, request.animationId, request.frameIndex),
      hidden,
      replaced,
    );
    if (weapon !== null) {
      applyEquipment(
        resolved,
        weapon,
        requirePieceSet(weapon, request.animationId, request.frameIndex),
        hidden,
        replaced,
      );
    }

    for (const layer of frame.hiddenLayers ?? []) {
      if (resolved.delete(layer)) hidden.add(layer);
    }

    const frameLayerSet = new Set(frame.layerOrder);
    for (const layer of resolved.keys()) {
      if (!frameLayerSet.has(layer)) {
        throw new CompositionError(
          'LAYER_NOT_IN_DRAW_ORDER',
          `Resolved layer ${layer} is absent from ${frame.id} draw order`,
          { layer, frameId: frame.id },
        );
      }
    }

    const drawCommands: DrawCommand[] = [];
    for (const layer of frame.layerOrder) {
      const selected = resolved.get(layer);
      if (selected === undefined) continue;
      const asset = this.catalog.assets.get(selected.assetId);
      if (asset === undefined) {
        throw new CompositionError(
          'MISSING_ASSET',
          `Resolved asset ${selected.assetId} does not exist`,
          { assetId: selected.assetId, layer, frameId: frame.id },
        );
      }
      if (asset.layer !== layer) {
        throw new CompositionError(
          'ASSET_LAYER_MISMATCH',
          `Asset ${asset.id} declares ${asset.layer} but was provided as ${layer}`,
          { assetId: asset.id, declaredLayer: asset.layer, layer },
        );
      }
      const anchor = frame.anchors[asset.attachmentAnchor];
      if (anchor === undefined) {
        throw new CompositionError(
          'MISSING_ANCHOR',
          `Asset ${asset.id} references missing anchor ${asset.attachmentAnchor}`,
          { assetId: asset.id, anchor: asset.attachmentAnchor, frameId: frame.id },
        );
      }
      drawCommands.push(
        Object.freeze({
          ordinal: drawCommands.length,
          layer,
          assetId: asset.id,
          shapeKey: asset.shapeKey,
          providerKind: selected.providerKind,
          providerId: selected.providerId,
          anchorName: asset.attachmentAnchor,
          anchor,
          offset: asset.offset ?? Object.freeze({ x: 0, y: 0 }),
          asset,
        }),
      );
    }

    const palette: PaletteDefinition = Object.freeze({
      ...SHARED_PALETTE,
      ...identity.palette,
      ...outfit.palette,
      ...(weapon?.palette ?? {}),
    });
    const hiddenLayers = Object.freeze(orderedLayers(hidden));
    const replacedLayers = Object.freeze(orderedLayers(replaced));
    const trace = Object.freeze(
      drawCommands.map(
        (command) =>
          `${String(command.ordinal).padStart(2, '0')}:${command.layer}:${command.providerKind}/${command.providerId}:${command.assetId}@${command.anchorName}(${command.anchor.x},${command.anchor.y})`,
      ),
    );
    const signatureSource = [
      request.animationId,
      String(request.frameIndex),
      frame.id,
      String(facing),
      `hidden=${hiddenLayers.join(',')}`,
      `replaced=${replacedLayers.join(',')}`,
      ...trace,
    ].join('|');

    return Object.freeze({
      animationId: request.animationId,
      frameIndex: request.frameIndex,
      frameId: frame.id,
      facing,
      rootOrigin: frame.rootOrigin,
      groundY: frame.groundY,
      anchors: frame.anchors,
      palette,
      drawCommands: Object.freeze(drawCommands),
      hiddenLayers,
      replacedLayers,
      trace,
      signature: fnv1a(signatureSource),
    });
  }

  resolvePlayer(
    appearance: AppearanceSelection,
    player: AnimationPlayerSnapshot,
    facing: Facing = 1,
  ): CompositionResult {
    return this.resolve({
      appearance,
      animationId: player.animationId,
      frameIndex: player.frameIndex,
      facing,
    });
  }
}

export const DEFAULT_COMPOSITION_RESOLVER = new CompositionResolver();

export function resolveComposition(
  request: CompositionRequest,
  catalog: CharacterCatalog = DEFAULT_CHARACTER_CATALOG,
): CompositionResult {
  return new CompositionResolver(catalog).resolve(request);
}
