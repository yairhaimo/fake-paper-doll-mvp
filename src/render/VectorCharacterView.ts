import {
  Assets,
  Container,
  Graphics,
  GraphicsContext,
  GraphicsPath,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";
import type {
  AnchorName,
  CompositionResult,
  PaletteDefinition,
  PieceDescriptor,
  RasterPieceDescriptor,
  SemanticLayer,
  VectorPrimitive,
} from "../character/types";

const DEBUG_COLORS: Readonly<Record<SemanticLayer, number>> = {
  groundShadow: 0x4b556f,
  tailBack: 0x8650a0,
  weaponBack: 0xd49450,
  earBack: 0x82bca1,
  tuftBack: 0x597d70,
  rearFoot: 0x5d78b6,
  rearLeg: 0x6d8bc8,
  rearArm: 0x5ca795,
  rearHand: 0x6cc3ad,
  body: 0x4fbea7,
  topBack: 0x4a5f8f,
  head: 0x76dbc0,
  face: 0xf09a87,
  bottoms: 0x626da5,
  frontLeg: 0x95afdf,
  frontFoot: 0x849bd2,
  top: 0xf0c875,
  frontArm: 0xe09572,
  frontHand: 0xffb092,
  tuftFront: 0xb4efd9,
  hoodOrHatFront: 0x8896d4,
  weaponFront: 0xe2a75f,
  accessoryFront: 0xf6d477,
};

const ANCHOR_COLORS: Readonly<Record<"body" | "limb" | "item", number>> = {
  body: 0xffd86d,
  limb: 0x76e1c2,
  item: 0xf58578,
};

const contextCache = new Map<string, GraphicsContext>();

interface CachedRasterTexture {
  readonly texture: Texture;
  /** Cropped textures are owned here; full-source textures remain Assets-owned. */
  readonly owned: boolean;
}

const rasterTextureCache = new Map<string, CachedRasterTexture>();
const rasterTexturePromises = new Map<string, Promise<Texture>>();
const rasterTextureErrors = new Map<string, Error>();

function rasterTextureKey(asset: RasterPieceDescriptor): string {
  const crop = asset.sourceRect;
  return crop === undefined
    ? asset.source
    : `${asset.source}|${crop.x},${crop.y},${crop.width},${crop.height}`;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function getLoadedRasterTexture(asset: RasterPieceDescriptor): Texture | undefined {
  return rasterTextureCache.get(rasterTextureKey(asset))?.texture;
}

async function loadRasterTexture(asset: RasterPieceDescriptor): Promise<Texture> {
  const key = rasterTextureKey(asset);
  const cached = rasterTextureCache.get(key);
  if (cached !== undefined) return cached.texture;

  const failed = rasterTextureErrors.get(key);
  if (failed !== undefined) throw failed;

  const inFlight = rasterTexturePromises.get(key);
  if (inFlight !== undefined) return inFlight;

  const load = Assets.load<Texture>(asset.source)
    .then((sourceTexture) => {
      if (!(sourceTexture instanceof Texture)) {
        throw new Error(`Raster source ${asset.source} did not resolve to a Pixi Texture`);
      }

      const crop = asset.sourceRect;
      const texture =
        crop === undefined
          ? sourceTexture
          : new Texture({
              source: sourceTexture.source,
              frame: new Rectangle(crop.x, crop.y, crop.width, crop.height),
              label: `${asset.id}:crop`,
            });
      rasterTextureCache.set(key, { texture, owned: crop !== undefined });
      rasterTextureErrors.delete(key);
      return texture;
    })
    .catch((error: unknown) => {
      const normalized = asError(error);
      rasterTextureErrors.set(key, normalized);
      throw normalized;
    })
    .finally(() => {
      rasterTexturePromises.delete(key);
    });

  rasterTexturePromises.set(key, load);
  return load;
}

export interface RasterPreloadDiagnostics {
  readonly loadedAssetIds: readonly string[];
  readonly failedAssetIds: readonly string[];
}

/**
 * Resolves every unique raster source/crop before the first synchronous render.
 * Individual failures are reported instead of rejecting so callers can render
 * their deterministic semantic fallback.
 */
export async function preloadRasterAssets(
  assets: Iterable<PieceDescriptor>,
): Promise<RasterPreloadDiagnostics> {
  const descriptors: RasterPieceDescriptor[] = [];
  const rasterAssets = new Map<string, RasterPieceDescriptor>();
  for (const asset of assets) {
    if (asset.kind === "raster") {
      descriptors.push(asset);
      rasterAssets.set(rasterTextureKey(asset), asset);
    }
  }
  await Promise.allSettled(
    [...rasterAssets.values()].map((asset) => loadRasterTexture(asset)),
  );

  const loadedAssetIds = new Set<string>();
  const failedAssetIds = new Set<string>();
  for (const asset of descriptors) {
    if (getLoadedRasterTexture(asset) !== undefined) {
      loadedAssetIds.add(asset.id);
    } else {
      failedAssetIds.add(asset.id);
    }
  }

  return Object.freeze({
    loadedAssetIds: Object.freeze([...loadedAssetIds].sort()),
    failedAssetIds: Object.freeze([...failedAssetIds].sort()),
  });
}

function paletteKey(palette: PaletteDefinition): string {
  return Object.entries(palette)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([token, value]) => `${token}:${value}`)
    .join("|");
}

function colorFromToken(
  token: string | undefined,
  palette: PaletteDefinition,
  missing: Set<string>,
): number | null {
  if (token === undefined || token === "none") return null;
  const value = palette[token];
  if (!value) {
    missing.add(token);
    return 0xff00ff;
  }
  const normalized = value.startsWith("#") ? value.slice(1) : value;
  const parsed = Number.parseInt(normalized, 16);
  if (!Number.isFinite(parsed)) {
    missing.add(token);
    return 0xff00ff;
  }
  return parsed;
}

function applyPaint(
  context: GraphicsContext,
  primitive: VectorPrimitive,
  palette: PaletteDefinition,
  missing: Set<string>,
): void {
  const fill = colorFromToken(primitive.fill, palette, missing);
  const stroke = colorFromToken(primitive.stroke, palette, missing);
  if (fill !== null) {
    context.fill({ color: fill, alpha: primitive.opacity ?? 1 });
  }
  if (stroke !== null && (primitive.strokeWidth ?? 0) > 0) {
    context.stroke({
      color: stroke,
      alpha: primitive.opacity ?? 1,
      width: primitive.strokeWidth ?? 1,
      cap: primitive.lineCap ?? "round",
      join: primitive.lineJoin ?? "round",
    });
  }
}

function appendPrimitive(
  context: GraphicsContext,
  primitive: VectorPrimitive,
  palette: PaletteDefinition,
  missing: Set<string>,
): void {
  switch (primitive.kind) {
    case "path":
      context.path(new GraphicsPath(primitive.d));
      break;
    case "ellipse":
      context.ellipse(primitive.cx, primitive.cy, primitive.rx, primitive.ry);
      break;
    case "roundRect":
      context.roundRect(
        primitive.x,
        primitive.y,
        primitive.width,
        primitive.height,
        primitive.radius,
      );
      break;
    case "polygon":
      context.poly(primitive.points.map(({ x, y }) => ({ x, y })), true);
      break;
    case "line":
      context.moveTo(primitive.from.x, primitive.from.y).lineTo(primitive.to.x, primitive.to.y);
      break;
  }
  applyPaint(context, primitive, palette, missing);
}

function buildContext(
  asset: PieceDescriptor,
  palette: PaletteDefinition,
  missing: Set<string>,
): GraphicsContext {
  const cacheKey = `${asset.id}|${paletteKey(palette)}`;
  const cached = contextCache.get(cacheKey);
  if (cached) return cached;

  const context = new GraphicsContext();
  asset.primitives.forEach((primitive) => appendPrimitive(context, primitive, palette, missing));
  contextCache.set(cacheKey, context);
  return context;
}

export interface CharacterViewDebugOptions {
  readonly layers: boolean;
  readonly anchors: boolean;
}

export interface CharacterRenderDiagnostics {
  readonly missingPaletteTokens: readonly string[];
  readonly activeLayers: readonly SemanticLayer[];
  /** Raster pieces currently showing their vector fallback while loading. */
  readonly pendingRasterAssets: readonly string[];
  /** Raster pieces showing their vector fallback because loading failed. */
  readonly failedRasterAssets: readonly string[];
}

interface PieceSlot {
  readonly root: Container;
  readonly vector: Graphics;
  readonly raster: Sprite;
}

const LABEL_STYLE = new TextStyle({
  fill: 0x20243d,
  fontFamily: "ui-monospace, monospace",
  fontSize: 8,
  fontWeight: "700",
  stroke: { color: 0xf8f3e5, width: 2.5 },
});

const ANCHOR_LABEL_OFFSETS: Readonly<
  Partial<Record<AnchorName, Readonly<{ x: number; y: number }>>>
> = {
  root: { x: 9, y: 8 },
  ground: { x: -44, y: 14 },
  neck: { x: -42, y: -13 },
  headTop: { x: 8, y: -17 },
  waist: { x: -35, y: -4 },
  shoulderFront: { x: 10, y: -20 },
  elbowFront: { x: 13, y: -12 },
  handFront: { x: 18, y: 14 },
  hipFront: { x: 11, y: -3 },
  kneeFront: { x: 11, y: -3 },
  footFront: { x: 16, y: 10 },
  weaponGrip: { x: 38, y: -18 },
};

const LABELLED_ANCHORS = new Set<AnchorName>([
  "root",
  "ground",
  "neck",
  "headTop",
  "handFront",
  "footFront",
  "weaponGrip",
]);

function anchorGroup(name: AnchorName): "body" | "limb" | "item" {
  if (name === "weaponGrip") return "item";
  if (
    name.includes("shoulder") ||
    name.includes("elbow") ||
    name.includes("hand") ||
    name.includes("hip") ||
    name.includes("knee") ||
    name.includes("foot")
  ) {
    return "limb";
  }
  return "body";
}

/**
 * Persistent Pixi view for one character.
 *
 * The world/root containers are never recreated when appearance changes. Each
 * animation frame swaps cached GraphicsContext/Texture objects on a stable slot
 * pool, preserving world state and avoiding display-tree rebuilds in the render
 * loop. Raster pieces fall back to their vector primitives until preloading (or
 * an automatic lazy load) completes.
 */
export class VectorCharacterView {
  readonly container = new Container();
  readonly facingContainer = new Container();
  readonly pieceContainer = new Container();
  readonly anchorContainer = new Container();

  private readonly piecePool: PieceSlot[] = [];
  private readonly anchorLabels: Text[] = [];
  private readonly pendingRasterAssetIds = new Set<string>();
  private readonly failedRasterAssetIds = new Set<string>();
  private rasterRevision = 0;
  private lastSignature = "";
  private lastAnchorKey = "";
  private lastFacing: -1 | 1 = 1;
  private debug: CharacterViewDebugOptions = { layers: false, anchors: false };

  constructor() {
    this.container.addChild(this.facingContainer, this.anchorContainer);
    this.facingContainer.addChild(this.pieceContainer);
    this.pieceContainer.sortableChildren = true;
  }

  setDebug(options: CharacterViewDebugOptions): void {
    const changed = options.layers !== this.debug.layers || options.anchors !== this.debug.anchors;
    this.debug = { ...options };
    this.anchorContainer.visible = options.anchors;
    if (changed) {
      this.lastSignature = "";
      this.lastAnchorKey = "";
    }
  }

  setWorldPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  /** Changes whenever a raster request starts or settles. */
  get rasterStateRevision(): number {
    return this.rasterRevision;
  }

  /**
   * Preloads authored bitmaps without mutating character simulation or display
   * hierarchy. Calling this before the first render avoids fallback frames.
   */
  async preload(assets: Iterable<PieceDescriptor>): Promise<void> {
    const materialized = [...assets];
    const rasterAssetIds = materialized
      .filter((asset): asset is RasterPieceDescriptor => asset.kind === "raster")
      .map(({ id }) => id);
    rasterAssetIds.forEach((id) => this.pendingRasterAssetIds.add(id));
    const diagnostics = await preloadRasterAssets(materialized);
    rasterAssetIds.forEach((id) => this.pendingRasterAssetIds.delete(id));
    diagnostics.loadedAssetIds.forEach((id) => this.failedRasterAssetIds.delete(id));
    diagnostics.failedAssetIds.forEach((id) => this.failedRasterAssetIds.add(id));
    this.rasterRevision += 1;
    this.lastSignature = "";
  }

  private getOrCreateSlot(index: number): PieceSlot {
    const existing = this.piecePool[index];
    if (existing !== undefined) return existing;

    const root = new Container();
    root.label = `piece-${index}`;
    const vector = new Graphics();
    vector.label = `piece-${index}:vector`;
    const raster = new Sprite({ texture: Texture.EMPTY });
    raster.label = `piece-${index}:raster`;
    raster.visible = false;
    root.addChild(vector, raster);
    this.pieceContainer.addChild(root);

    const slot = { root, vector, raster };
    this.piecePool[index] = slot;
    return slot;
  }

  private requestRasterAsset(asset: RasterPieceDescriptor): void {
    if (
      this.pendingRasterAssetIds.has(asset.id) ||
      this.failedRasterAssetIds.has(asset.id)
    ) {
      return;
    }

    this.pendingRasterAssetIds.add(asset.id);
    this.rasterRevision += 1;
    void loadRasterTexture(asset)
      .then(() => {
        this.pendingRasterAssetIds.delete(asset.id);
        this.failedRasterAssetIds.delete(asset.id);
        this.rasterRevision += 1;
        this.lastSignature = "";
      })
      .catch(() => {
        this.pendingRasterAssetIds.delete(asset.id);
        this.failedRasterAssetIds.add(asset.id);
        this.rasterRevision += 1;
        this.lastSignature = "";
      });
  }

  private configureSlot(
    slot: PieceSlot,
    asset: PieceDescriptor,
    palette: PaletteDefinition,
    missing: Set<string>,
    label: string,
    color: number,
    alpha: number,
  ): void {
    const rasterTexture =
      asset.kind === "raster" ? getLoadedRasterTexture(asset) : undefined;
    if (asset.kind === "raster" && rasterTexture !== undefined) {
      const anchor = asset.sourceAnchor ?? { x: 0, y: 0 };
      slot.raster.texture = rasterTexture;
      slot.raster.anchor.set(anchor.x, anchor.y);
      slot.raster.setSize(asset.bounds.width, asset.bounds.height);
      slot.raster.position.set(
        asset.bounds.x + asset.bounds.width * anchor.x,
        asset.bounds.y + asset.bounds.height * anchor.y,
      );
      slot.raster.visible = true;
      slot.raster.alpha = alpha;
      slot.raster.tint = color;
      slot.raster.label = `${label}:raster`;
      slot.vector.visible = false;
      return;
    }

    if (asset.kind === "raster") this.requestRasterAsset(asset);
    slot.vector.context = buildContext(asset, palette, missing);
    slot.vector.position.set(0, 0);
    slot.vector.visible = true;
    slot.vector.alpha = alpha;
    slot.vector.tint = color;
    slot.vector.label = `${label}:vector-fallback`;
    slot.raster.visible = false;
  }

  render(composition: CompositionResult): CharacterRenderDiagnostics {
    const missing = new Set<string>();
    this.lastFacing = composition.facing;
    this.facingContainer.scale.x = composition.facing;

    const presentationCandidate = this.debug.layers
      ? undefined
      : composition.presentationPiece;
    const presentation =
      presentationCandidate !== undefined &&
      getLoadedRasterTexture(presentationCandidate) !== undefined
        ? presentationCandidate
        : undefined;
    if (presentationCandidate !== undefined && presentation === undefined) {
      this.requestRasterAsset(presentationCandidate);
    }
    const signature = [
      composition.signature,
      composition.frameId,
      this.debug.layers,
      presentationCandidate?.id ?? "semantic",
      presentation === undefined ? "fallback" : "ready",
    ].join(":");
    if (signature !== this.lastSignature) {
      let visibleSlotCount = 0;

      if (presentation !== undefined) {
        const slot = this.getOrCreateSlot(0);
        const anchor = composition.anchors[presentation.attachmentAnchor];
        const label = `${presentation.layer}:presentation:${presentation.shapeKey}`;
        slot.root.position.set(
          anchor.x - composition.rootOrigin.x + (presentation.offset?.x ?? 0),
          anchor.y - composition.rootOrigin.y + (presentation.offset?.y ?? 0),
        );
        slot.root.zIndex = 0;
        slot.root.visible = true;
        slot.root.label = label;
        this.configureSlot(
          slot,
          presentation,
          composition.palette,
          missing,
          label,
          0xffffff,
          1,
        );
        visibleSlotCount = 1;
      } else {
        composition.drawCommands.forEach((command, index) => {
          const slot = this.getOrCreateSlot(index);
          const label = `${command.layer}:${command.providerId}:${command.shapeKey}`;
          const color = this.debug.layers ? DEBUG_COLORS[command.layer] : 0xffffff;
          const alpha = this.debug.layers ? 0.91 : 1;

          slot.root.position.set(
            command.anchor.x - composition.rootOrigin.x + command.offset.x,
            command.anchor.y - composition.rootOrigin.y + command.offset.y,
          );
          slot.root.zIndex = command.ordinal;
          slot.root.visible = true;
          slot.root.label = label;
          this.configureSlot(
            slot,
            command.asset,
            composition.palette,
            missing,
            label,
            color,
            alpha,
          );
        });
        visibleSlotCount = composition.drawCommands.length;
      }

      for (let index = visibleSlotCount; index < this.piecePool.length; index += 1) {
        this.piecePool[index]!.root.visible = false;
      }
      this.lastSignature = signature;
    }

    const anchorKey = `${composition.frameId}:${composition.facing}`;
    if (this.debug.anchors && anchorKey !== this.lastAnchorKey) {
      this.drawAnchors(composition);
    }
    this.lastAnchorKey = anchorKey;

    return {
      missingPaletteTokens: [...missing].sort(),
      activeLayers: composition.drawCommands.map(({ layer }) => layer),
      pendingRasterAssets: [...this.pendingRasterAssetIds].sort(),
      failedRasterAssets: [...this.failedRasterAssetIds].sort(),
    };
  }

  private drawAnchors(composition: CompositionResult): void {
    this.anchorContainer.removeChildren();
    this.anchorLabels.length = 0;
    const geometry = new Graphics();
    const selectedAnchors: AnchorName[] = [
      "root",
      "ground",
      "neck",
      "headTop",
      "waist",
      "shoulderFront",
      "elbowFront",
      "handFront",
      "hipFront",
      "kneeFront",
      "footFront",
      "weaponGrip",
    ];

    for (const name of selectedAnchors) {
      const anchor = composition.anchors[name];
      const x = (anchor.x - composition.rootOrigin.x) * this.lastFacing;
      const y = anchor.y - composition.rootOrigin.y;
      const color = ANCHOR_COLORS[anchorGroup(name)];
      geometry.circle(x, y, name === "root" ? 4 : 2.7).fill({ color, alpha: 0.94 });
      geometry.circle(x, y, name === "root" ? 6 : 4.7).stroke({ color, width: 1, alpha: 0.72 });

      if (!LABELLED_ANCHORS.has(name)) continue;

      const configuredOffset = ANCHOR_LABEL_OFFSETS[name] ?? { x: 6, y: -8 };
      const offsetX = configuredOffset.x * this.lastFacing;
      geometry
        .moveTo(x, y)
        .lineTo(x + offsetX * 0.76, y + configuredOffset.y * 0.76)
        .stroke({ color, width: 0.8, alpha: 0.46 });
      const label = new Text({ text: name, style: LABEL_STYLE });
      label.position.set(x + offsetX, y + configuredOffset.y);
      if (this.lastFacing === -1) label.anchor.set(1, 0);
      this.anchorLabels.push(label);
    }

    const root = composition.anchors.root;
    const ground = composition.anchors.ground;
    geometry
      .moveTo((root.x - composition.rootOrigin.x) * this.lastFacing - 34, ground.y - composition.rootOrigin.y)
      .lineTo((root.x - composition.rootOrigin.x) * this.lastFacing + 34, ground.y - composition.rootOrigin.y)
      .stroke({ color: 0xffd86d, width: 1, alpha: 0.72 });
    this.anchorContainer.addChild(geometry, ...this.anchorLabels);
  }

  destroy(): void {
    this.piecePool.forEach((slot) => {
      slot.root.removeChildren();
      slot.vector.destroy({ context: false });
      slot.raster.destroy({ texture: false, textureSource: false });
      slot.root.destroy();
    });
    this.piecePool.length = 0;
    this.anchorLabels.length = 0;
    this.container.destroy({ children: true });
  }
}

export function clearVectorContextCache(): void {
  contextCache.forEach((context) => context.destroy());
  contextCache.clear();
}

/** Clears view-owned crop textures. Pixi Assets-owned source textures remain cached. */
export function clearRasterTextureCache(): void {
  rasterTextureCache.forEach(({ texture, owned }) => {
    if (owned) texture.destroy(false);
  });
  rasterTextureCache.clear();
  rasterTexturePromises.clear();
  rasterTextureErrors.clear();
}

export function clearCharacterPieceCaches(): void {
  clearVectorContextCache();
  clearRasterTextureCache();
}
