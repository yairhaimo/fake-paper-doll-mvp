import { CANONICAL_BODY } from './canonicalBody';
import { CompositionError, CompositionResolver } from './compositionResolver';
import { DEFAULT_CHARACTER_CATALOG } from './registries';
import {
  ANCHOR_NAMES,
  ANIMATION_IDS,
  SEMANTIC_LAYERS,
  type CharacterCatalog,
  type EquipmentDefinition,
  type IdentityDefinition,
  type SemanticLayer,
  type ValidationIssue,
  type ValidationReport,
} from './types';

const REQUIRED_POSE_SPECIFIC_LAYERS = new Set<SemanticLayer>([
  'rearArm',
  'frontArm',
  'rearFoot',
  'frontFoot',
]);

function issue(
  issues: ValidationIssue[],
  code: string,
  message: string,
  context: Readonly<Record<string, string | number>> = {},
): void {
  issues.push(Object.freeze({ severity: 'error', code, message, context }));
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function validateContract(issues: ValidationIssue[]): void {
  if (CANONICAL_BODY.logicalWidth !== 256 || CANONICAL_BODY.logicalHeight !== 256) {
    issue(issues, 'INVALID_LOGICAL_CANVAS', 'Canonical canvas must remain 256x256');
  }
  if (!Number.isInteger(CANONICAL_BODY.tickRate) || CANONICAL_BODY.tickRate <= 0) {
    issue(issues, 'INVALID_TICK_RATE', 'Canonical tick rate must be a positive integer');
  }

  for (const animationId of ANIMATION_IDS) {
    const animation = CANONICAL_BODY.animations[animationId];
    if (animation.id !== animationId) {
      issue(issues, 'ANIMATION_ID_MISMATCH', `${animationId} definition ID does not match`);
    }
    if (animation.frames.length === 0) {
      issue(issues, 'EMPTY_ANIMATION', `${animationId} has no frames`);
    }

    animation.frames.forEach((frame, frameIndex) => {
      if (frame.id !== `${animationId}_${frameIndex}`) {
        issue(
          issues,
          'UNSTABLE_FRAME_ID',
          `${animationId} frame ${frameIndex} must use stable ID ${animationId}_${frameIndex}`,
          { frameId: frame.id },
        );
      }
      if (!Number.isSafeInteger(frame.durationTicks) || frame.durationTicks <= 0) {
        issue(
          issues,
          'INVALID_FRAME_DURATION',
          `${frame.id} duration must be a positive integer`,
        );
      }
      if (
        frame.rootOrigin.x !== CANONICAL_BODY.rootOrigin.x ||
        frame.rootOrigin.y !== CANONICAL_BODY.rootOrigin.y ||
        frame.groundY !== CANONICAL_BODY.groundY
      ) {
        issue(
          issues,
          'ROOT_CONTRACT_BROKEN',
          `${frame.id} changes the canonical root or ground`,
        );
      }

      for (const anchorName of ANCHOR_NAMES) {
        const anchor = frame.anchors[anchorName];
        if (anchor === undefined || !finite(anchor.x) || !finite(anchor.y)) {
          issue(
            issues,
            'INVALID_ANCHOR',
            `${frame.id} has no finite ${anchorName} anchor`,
            { frameId: frame.id, anchorName },
          );
        }
      }

      const layerSet = new Set(frame.layerOrder);
      if (layerSet.size !== frame.layerOrder.length) {
        issue(issues, 'DUPLICATE_DRAW_LAYER', `${frame.id} draw order has duplicates`);
      }
      for (const layer of frame.layerOrder) {
        if (!SEMANTIC_LAYERS.includes(layer)) {
          issue(
            issues,
            'UNKNOWN_DRAW_LAYER',
            `${frame.id} contains unknown draw layer ${String(layer)}`,
          );
        }
      }
    });
  }
}

function validateProvider(
  definition: IdentityDefinition | EquipmentDefinition,
  catalog: CharacterCatalog,
  issues: ValidationIssue[],
): void {
  const supported = new Set(definition.supportedLayers);
  if (supported.size !== definition.supportedLayers.length) {
    issue(
      issues,
      'DUPLICATE_SUPPORTED_LAYER',
      `${definition.slot} ${definition.id} repeats a supported layer`,
    );
  }

  for (const animationId of ANIMATION_IDS) {
    if (!definition.animationCoverage.includes(animationId)) {
      issue(
        issues,
        'MISSING_ANIMATION_COVERAGE',
        `${definition.slot} ${definition.id} omits ${animationId}`,
      );
    }
    const expectedFrames = CANONICAL_BODY.animations[animationId].frames;
    const pieceFrames = definition.pieces[animationId];
    if (pieceFrames.length !== expectedFrames.length) {
      issue(
        issues,
        'FRAME_COVERAGE_MISMATCH',
        `${definition.slot} ${definition.id} has ${pieceFrames.length}/${expectedFrames.length} ${animationId} frames`,
        { providerId: definition.id, animationId },
      );
    }

    pieceFrames.forEach((pieceSet, frameIndex) => {
      const frame = expectedFrames[frameIndex];
      if (frame === undefined) return;
      for (const layer of SEMANTIC_LAYERS) {
        const assetId = pieceSet[layer];
        if (assetId === undefined) continue;
        if (!supported.has(layer)) {
          issue(
            issues,
            'UNDECLARED_PROVIDER_LAYER',
            `${definition.slot} ${definition.id} provides undeclared ${layer}`,
            { providerId: definition.id, animationId, frameIndex, layer },
          );
        }
        const asset = catalog.assets.get(assetId);
        if (asset === undefined) {
          issue(
            issues,
            'MISSING_ASSET',
            `${definition.slot} ${definition.id} references missing asset ${assetId}`,
            { providerId: definition.id, animationId, frameIndex, layer },
          );
          continue;
        }
        if (asset.layer !== layer) {
          issue(
            issues,
            'ASSET_LAYER_MISMATCH',
            `${asset.id} declares ${asset.layer} but is bound to ${layer}`,
            { assetId: asset.id, layer },
          );
        }
        if (!frame.anchors[asset.attachmentAnchor]) {
          issue(
            issues,
            'MISSING_ASSET_ANCHOR',
            `${asset.id} references unknown frame anchor ${asset.attachmentAnchor}`,
            { assetId: asset.id, frameId: frame.id },
          );
        }
        if (
          REQUIRED_POSE_SPECIFIC_LAYERS.has(layer) &&
          !asset.shapeKey.includes(frame.id)
        ) {
          issue(
            issues,
            'NON_POSE_SPECIFIC_SHAPE',
            `${asset.id} does not identify its authored pose ${frame.id}`,
            { assetId: asset.id, frameId: frame.id, layer },
          );
        }
      }
    });
  }

  if (definition.slot !== 'identity') {
    const hidden = new Set(definition.hideLayers);
    const replaced = new Set(definition.replaceLayers);
    for (const layer of definition.hideLayers) {
      if (replaced.has(layer)) {
        issue(
          issues,
          'CONFLICTING_LAYER_RULE',
          `${definition.slot} ${definition.id} both hides and replaces ${layer}`,
        );
      }
    }
    if (hidden.size !== definition.hideLayers.length) {
      issue(issues, 'DUPLICATE_HIDE_RULE', `${definition.id} repeats a hide rule`);
    }
    if (replaced.size !== definition.replaceLayers.length) {
      issue(issues, 'DUPLICATE_REPLACE_RULE', `${definition.id} repeats a replace rule`);
    }
  }
}

function validateAssets(catalog: CharacterCatalog, issues: ValidationIssue[]): void {
  for (const [key, asset] of catalog.assets) {
    if (key !== asset.id) {
      issue(issues, 'ASSET_KEY_MISMATCH', `Asset registry key ${key} != ${asset.id}`);
    }
    if (asset.primitives.length === 0) {
      issue(issues, 'EMPTY_VECTOR_ASSET', `${asset.id} has no vector primitives`);
    }
    if (
      !finite(asset.bounds.x) ||
      !finite(asset.bounds.y) ||
      !finite(asset.bounds.width) ||
      !finite(asset.bounds.height) ||
      asset.bounds.width <= 0 ||
      asset.bounds.height <= 0
    ) {
      issue(issues, 'INVALID_ASSET_BOUNDS', `${asset.id} has invalid local bounds`);
    }
  }
}

export function validateCharacterSystem(
  catalog: CharacterCatalog = DEFAULT_CHARACTER_CATALOG,
): ValidationReport {
  const issues: ValidationIssue[] = [];
  validateContract(issues);
  validateAssets(catalog, issues);

  for (const definition of catalog.identities.values()) {
    validateProvider(definition, catalog, issues);
  }
  for (const definition of catalog.outfits.values()) {
    validateProvider(definition, catalog, issues);
  }
  for (const definition of catalog.weapons.values()) {
    validateProvider(definition, catalog, issues);
  }

  const resolver = new CompositionResolver(catalog);
  let checkedCompositions = 0;
  const weaponIds: (string | null)[] = [null, ...catalog.weapons.keys()];

  for (const identityId of catalog.identities.keys()) {
    for (const outfitId of catalog.outfits.keys()) {
      for (const weaponId of weaponIds) {
        for (const animationId of ANIMATION_IDS) {
          const frames = CANONICAL_BODY.animations[animationId].frames;
          frames.forEach((_frame, frameIndex) => {
            checkedCompositions += 1;
            try {
              resolver.resolve({
                appearance: { identityId, outfitId, weaponId },
                animationId,
                frameIndex,
              });
            } catch (error) {
              const errorCode =
                error instanceof CompositionError ? error.code : 'UNEXPECTED_ERROR';
              issue(
                issues,
                `COMPOSITION_${errorCode}`,
                `Cannot compose ${identityId}/${outfitId}/${weaponId ?? 'none'} ${animationId}_${frameIndex}: ${error instanceof Error ? error.message : String(error)}`,
                { identityId, outfitId, weaponId: weaponId ?? 'none', animationId, frameIndex },
              );
            }
          });
        }
      }
    }
  }

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
    checkedCompositions,
  });
}

export function assertValidCharacterSystem(
  catalog: CharacterCatalog = DEFAULT_CHARACTER_CATALOG,
): void {
  const report = validateCharacterSystem(catalog);
  if (!report.valid) {
    const summary = report.issues
      .slice(0, 8)
      .map((candidate) => `${candidate.code}: ${candidate.message}`)
      .join('\n');
    throw new Error(
      `Character system validation failed with ${report.issues.length} issue(s):\n${summary}`,
    );
  }
}
