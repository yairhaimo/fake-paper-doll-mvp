import { CANONICAL_BODY } from "./canonicalBody";
import {
  ANIMATION_IDS,
  type AnimationId,
  type AppearanceSelection,
  type Bounds,
  type RasterPieceDescriptor,
} from "./types";

const CELL_SIZE = 512;
const LOGICAL_SCALE = 2 / 3;

const IDENTITY_IDS = ["moss", "bramble"] as const;
const OUTFIT_IDS = ["trail", "hoodie"] as const;
const WEAPON_IDS = [null, "wooden-sword"] as const;

/**
 * The six cells in each general sheet are authored as:
 * idle, run stride, airborne stride, fall/open, land/brace, action stance.
 */
const UNARMED_ATTACK_CELLS = [5, 1, 2, 5, 4, 0] as const;

function cellFor(
  animationId: AnimationId,
  frameIndex: number,
  equipped: boolean,
): number {
  switch (animationId) {
    case "idle":
      return 0;
    case "run":
      return frameIndex;
    case "jump":
      return 2;
    case "fall":
      return 3;
    case "land":
      return 4;
    case "attack":
      return equipped ? frameIndex : UNARMED_ATTACK_CELLS[frameIndex]!;
  }
}

function sourceRect(cell: number): Bounds {
  return Object.freeze({
    x: (cell % 3) * CELL_SIZE,
    y: Math.floor(cell / 3) * CELL_SIZE,
    width: CELL_SIZE,
    height: CELL_SIZE,
  });
}

function destinationBounds(
  animationId: AnimationId,
  frameIndex: number,
): Bounds {
  // The idle cycle reuses one painted pose. A restrained 0.5–1% scale pulse
  // supplies breathing without disturbing the planted feet or compositor time.
  const idleScale = [1, 1.005, 1.01, 1.005] as const;
  const breath = animationId === "idle" ? idleScale[frameIndex]! : 1;
  const scale = LOGICAL_SCALE * breath;
  const size = CELL_SIZE * scale;
  return Object.freeze({
    x: -size / 2,
    y: -size,
    width: size,
    height: size,
  });
}

function sheetVariant(animationId: AnimationId, equipped: boolean): string {
  if (animationId === "attack" && equipped) return "attack";
  if (animationId === "run") return equipped ? "run-armed" : "run-unarmed";
  return equipped ? "armed" : "unarmed";
}

function presentationKey(
  appearance: AppearanceSelection,
  animationId: AnimationId,
  frameIndex: number,
): string {
  return [
    appearance.identityId,
    appearance.outfitId,
    appearance.weaponId ?? "unarmed",
    animationId,
    frameIndex,
  ].join(":");
}

function createPresentationPiece(
  appearance: AppearanceSelection,
  animationId: AnimationId,
  frameIndex: number,
): RasterPieceDescriptor {
  const equipped = appearance.weaponId !== null;
  const variant = sheetVariant(animationId, equipped);
  const cell = cellFor(animationId, frameIndex, equipped);
  const id = `presentation:${presentationKey(appearance, animationId, frameIndex)}`;

  return Object.freeze({
    id,
    kind: "raster",
    shapeKey: `authored-pose:${variant}:cell-${cell}`,
    layer: "accessoryFront",
    attachmentAnchor: "root",
    bounds: destinationBounds(animationId, frameIndex),
    source: `/assets/character/v2/${appearance.identityId}-${appearance.outfitId}-${variant}.png`,
    sourceRect: sourceRect(cell),
    primitives: Object.freeze([]),
    tags: Object.freeze([
      "presentation",
      appearance.identityId,
      appearance.outfitId,
      equipped ? "armed" : "unarmed",
      animationId,
    ]),
  });
}

const presentationByComposition = new Map<string, RasterPieceDescriptor>();

for (const identityId of IDENTITY_IDS) {
  for (const outfitId of OUTFIT_IDS) {
    for (const weaponId of WEAPON_IDS) {
      const appearance = Object.freeze({ identityId, outfitId, weaponId });
      for (const animationId of ANIMATION_IDS) {
        const frames = CANONICAL_BODY.animations[animationId].frames;
        frames.forEach((_frame, frameIndex) => {
          const piece = createPresentationPiece(appearance, animationId, frameIndex);
          presentationByComposition.set(
            presentationKey(appearance, animationId, frameIndex),
            piece,
          );
        });
      }
    }
  }
}

/** Every authored presentation selection (2 identities × 2 outfits × 2 weapon states × 21 frames). */
export const AUTHORED_PRESENTATION_PIECES: readonly RasterPieceDescriptor[] =
  Object.freeze([...presentationByComposition.values()]);

/**
 * Returns the presentation-only full-pose painting for a semantic composition.
 * Unknown/custom catalog combinations intentionally return undefined so the
 * renderer can keep using the semantic piece stack as a complete fallback.
 */
export function resolveAuthoredPresentationPiece(
  appearance: AppearanceSelection,
  animationId: AnimationId,
  frameIndex: number,
): RasterPieceDescriptor | undefined {
  return presentationByComposition.get(
    presentationKey(appearance, animationId, frameIndex),
  );
}
