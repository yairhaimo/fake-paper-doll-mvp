import {
  Container,
  Graphics,
  GraphicsContext,
  GraphicsPath,
  Text,
  TextStyle,
} from "pixi.js";
import type {
  AnchorName,
  CompositionResult,
  PaletteDefinition,
  SemanticLayer,
  VectorPieceDescriptor,
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
  asset: VectorPieceDescriptor,
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
 * animation frame swaps cached GraphicsContext objects on a stable graphics
 * pool, preserving world state and avoiding geometry rebuilds in the render loop.
 */
export class VectorCharacterView {
  readonly container = new Container();
  readonly facingContainer = new Container();
  readonly pieceContainer = new Container();
  readonly anchorContainer = new Container();

  private readonly graphicsPool: Graphics[] = [];
  private readonly anchorLabels: Text[] = [];
  private lastSignature = "";
  private lastFrame = "";
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
      this.lastFrame = "";
    }
  }

  setWorldPosition(x: number, y: number): void {
    this.container.position.set(x, y);
  }

  render(composition: CompositionResult): CharacterRenderDiagnostics {
    const missing = new Set<string>();
    this.lastFacing = composition.facing;
    this.facingContainer.scale.x = composition.facing;

    const signature = `${composition.signature}:${composition.frameId}:${this.debug.layers}`;
    if (signature !== this.lastSignature) {
      composition.drawCommands.forEach((command, index) => {
        let graphic = this.graphicsPool[index];
        if (!graphic) {
          graphic = new Graphics();
          graphic.label = `piece-${index}`;
          this.graphicsPool[index] = graphic;
          this.pieceContainer.addChild(graphic);
        }

        graphic.context = buildContext(command.asset, composition.palette, missing);
        graphic.position.set(
          command.anchor.x - composition.rootOrigin.x + command.offset.x,
          command.anchor.y - composition.rootOrigin.y + command.offset.y,
        );
        graphic.zIndex = command.ordinal;
        graphic.visible = true;
        graphic.alpha = this.debug.layers ? 0.91 : 1;
        graphic.tint = this.debug.layers ? DEBUG_COLORS[command.layer] : 0xffffff;
        graphic.label = `${command.layer}:${command.providerId}:${command.shapeKey}`;
      });

      for (let index = composition.drawCommands.length; index < this.graphicsPool.length; index += 1) {
        this.graphicsPool[index]!.visible = false;
      }
      this.lastSignature = signature;
    }

    if (this.debug.anchors && composition.frameId !== this.lastFrame) {
      this.drawAnchors(composition);
    }
    this.lastFrame = composition.frameId;

    return {
      missingPaletteTokens: [...missing].sort(),
      activeLayers: composition.drawCommands.map(({ layer }) => layer),
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
    this.graphicsPool.forEach((graphic) => graphic.destroy({ context: false }));
    this.graphicsPool.length = 0;
    this.anchorLabels.length = 0;
    this.container.destroy({ children: true });
  }
}

export function clearVectorContextCache(): void {
  contextCache.forEach((context) => context.destroy());
  contextCache.clear();
}
