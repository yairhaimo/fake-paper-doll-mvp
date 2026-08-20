/**
 * Pure data types for the fake paper-doll runtime.
 *
 * The core deliberately knows nothing about PixiJS or the DOM. A renderer only
 * needs to consume CompositionResult.drawCommands and the authored piece
 * descriptors. Pieces can be vector-authored or raster-backed with a vector
 * fallback; neither representation leaks into simulation state.
 */

export const ANIMATION_IDS = [
  'idle',
  'run',
  'jump',
  'fall',
  'land',
  'attack',
] as const;

export type AnimationId = (typeof ANIMATION_IDS)[number];

export const SEMANTIC_LAYERS = [
  'groundShadow',
  'tailBack',
  'weaponBack',
  'earBack',
  'tuftBack',
  'rearFoot',
  'rearLeg',
  'rearArm',
  'rearHand',
  'body',
  'topBack',
  'head',
  'face',
  'bottoms',
  'frontLeg',
  'frontFoot',
  'top',
  'frontArm',
  'frontHand',
  'tuftFront',
  'hoodOrHatFront',
  'weaponFront',
  'accessoryFront',
] as const;

export type SemanticLayer = (typeof SEMANTIC_LAYERS)[number];

export const ANCHOR_NAMES = [
  'root',
  'ground',
  'neck',
  'headTop',
  'faceCenter',
  'shoulderRear',
  'elbowRear',
  'handRear',
  'shoulderFront',
  'elbowFront',
  'handFront',
  'waist',
  'hipRear',
  'kneeRear',
  'footRear',
  'hipFront',
  'kneeFront',
  'footFront',
  'tailRoot',
  'weaponGrip',
] as const;

export type AnchorName = (typeof ANCHOR_NAMES)[number];

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Facing = -1 | 1;

export type PoseChannel =
  | 'body'
  | 'head'
  | 'face'
  | 'tail'
  | 'tuft'
  | 'rearArm'
  | 'rearHand'
  | 'frontArm'
  | 'frontHand'
  | 'rearLeg'
  | 'frontLeg'
  | 'rearFoot'
  | 'frontFoot'
  | 'weapon';

export type PoseTags = Readonly<Record<PoseChannel, string>>;

export interface FrameDefinition {
  /** Stable authoring ID; never inferred from array position. */
  readonly id: string;
  /** Integer simulation ticks. Fractions are intentionally invalid. */
  readonly durationTicks: number;
  readonly rootOrigin: Point;
  readonly groundY: number;
  readonly anchors: Readonly<Record<AnchorName, Point>>;
  readonly layerOrder: readonly SemanticLayer[];
  readonly hiddenLayers?: readonly SemanticLayer[];
  readonly poses: PoseTags;
}

export interface AnimationDefinition {
  readonly id: AnimationId;
  readonly loop: boolean;
  readonly frames: readonly FrameDefinition[];
}

export interface CanonicalBodyContract {
  readonly version: number;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly tickRate: number;
  readonly rootOrigin: Point;
  readonly groundY: number;
  readonly unarmedEnvelope: Bounds;
  readonly weaponEnvelope: Bounds;
  readonly requiredAnchors: readonly AnchorName[];
  readonly defaultLayerOrder: readonly SemanticLayer[];
  readonly animations: Readonly<Record<AnimationId, AnimationDefinition>>;
}

export type PaletteToken =
  | `identity.${string}`
  | `outfit.${string}`
  | `weapon.${string}`
  | `shared.${string}`;

export interface VectorPaint {
  readonly fill?: PaletteToken | 'none';
  readonly stroke?: PaletteToken | 'none';
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly lineCap?: 'round' | 'square' | 'butt';
  readonly lineJoin?: 'round' | 'bevel' | 'miter';
}

export type VectorPrimitive =
  | ({
      readonly kind: 'path';
      readonly d: string;
    } & VectorPaint)
  | ({
      readonly kind: 'ellipse';
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
    } & VectorPaint)
  | ({
      readonly kind: 'roundRect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly radius: number;
    } & VectorPaint)
  | ({
      readonly kind: 'polygon';
      readonly points: readonly Point[];
    } & VectorPaint)
  | ({
      readonly kind: 'line';
      readonly from: Point;
      readonly to: Point;
    } & VectorPaint);

interface PieceDescriptorBase {
  readonly id: string;
  /** Describes the authored contour, and is useful in debug tooling. */
  readonly shapeKey: string;
  readonly layer: SemanticLayer;
  readonly attachmentAnchor: AnchorName;
  readonly offset?: Point;
  readonly bounds: Bounds;
  readonly tags?: readonly string[];
}

export interface VectorPieceDescriptor extends PieceDescriptorBase {
  /** Omitted by legacy/authored vector registries for backwards compatibility. */
  readonly kind?: 'vector';
  readonly primitives: readonly VectorPrimitive[];
}

/**
 * An authored bitmap piece that participates in the same semantic layer and
 * anchor contract as a vector piece.
 *
 * `source` is a Pixi Assets URL or alias. `sourceRect`, when present, crops a
 * frame from that texture in source pixels. `sourceAnchor` is normalized to the
 * cropped frame (0..1). `bounds` is the destination rectangle, in canonical
 * character units and relative to `attachmentAnchor` plus `offset`.
 *
 * Raster pieces retain vector primitives as a deterministic fallback while the
 * source is loading or if loading fails. This also keeps debug and headless
 * validation useful without needing a GPU or image decoder.
 */
export interface RasterPieceDescriptor extends PieceDescriptorBase {
  readonly kind: 'raster';
  readonly source: string;
  readonly sourceRect?: Bounds;
  readonly sourceAnchor?: Point;
  readonly primitives: readonly VectorPrimitive[];
}

export type PieceDescriptor = VectorPieceDescriptor | RasterPieceDescriptor;

export type LayerPieceMap = Readonly<Partial<Record<SemanticLayer, string>>>;
export type AnimationPieceTable = Readonly<
  Record<AnimationId, readonly LayerPieceMap[]>
>;

export interface PaletteDefinition {
  readonly [token: string]: string;
}

export interface IdentityDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly slot: 'identity';
  readonly palette: PaletteDefinition;
  readonly supportedLayers: readonly SemanticLayer[];
  readonly animationCoverage: readonly AnimationId[];
  readonly pieces: AnimationPieceTable;
}

export interface EquipmentDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly slot: 'outfit' | 'weapon';
  readonly palette: PaletteDefinition;
  readonly supportedLayers: readonly SemanticLayer[];
  readonly animationCoverage: readonly AnimationId[];
  /** Base or earlier-provider layers removed without a replacement. */
  readonly hideLayers: readonly SemanticLayer[];
  /** Earlier-provider layers that this definition is allowed to replace. */
  readonly replaceLayers: readonly SemanticLayer[];
  readonly pieces: AnimationPieceTable;
}

export interface CharacterCatalog {
  readonly assets: ReadonlyMap<string, PieceDescriptor>;
  readonly identities: ReadonlyMap<string, IdentityDefinition>;
  readonly outfits: ReadonlyMap<string, EquipmentDefinition>;
  readonly weapons: ReadonlyMap<string, EquipmentDefinition>;
}

export interface AppearanceSelection {
  readonly identityId: string;
  readonly outfitId: string;
  readonly weaponId: string | null;
}

export interface AppearanceSnapshot extends AppearanceSelection {
  readonly revision: number;
}

export type PieceProviderKind = 'identity' | 'outfit' | 'weapon';

export interface DrawCommand {
  readonly ordinal: number;
  readonly layer: SemanticLayer;
  readonly assetId: string;
  readonly shapeKey: string;
  readonly providerKind: PieceProviderKind;
  readonly providerId: string;
  readonly anchorName: AnchorName;
  readonly anchor: Point;
  readonly offset: Point;
  readonly asset: PieceDescriptor;
}

export interface CompositionResult {
  /** Immutable selection used to resolve this frame. */
  readonly appearance: AppearanceSelection;
  readonly animationId: AnimationId;
  readonly frameIndex: number;
  readonly frameId: string;
  readonly facing: Facing;
  readonly rootOrigin: Point;
  readonly groundY: number;
  readonly anchors: Readonly<Record<AnchorName, Point>>;
  readonly palette: PaletteDefinition;
  readonly drawCommands: readonly DrawCommand[];
  readonly hiddenLayers: readonly SemanticLayer[];
  readonly replacedLayers: readonly SemanticLayer[];
  readonly trace: readonly string[];
  /**
   * Optional authored full-pose painting used by the presentation renderer.
   * Semantic draw commands remain authoritative for debugging and validation.
   */
  readonly presentationPiece?: RasterPieceDescriptor;
  /** Stable FNV-1a digest of the semantic composition, not raster pixels. */
  readonly signature: string;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, string | number>>;
}

export interface ValidationReport {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly checkedCompositions: number;
}
