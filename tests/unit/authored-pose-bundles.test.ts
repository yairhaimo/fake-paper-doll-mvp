import { describe, expect, it } from "vitest";

import {
  ANIMATION_IDS,
  AUTHORED_PRESENTATION_PIECES,
  CANONICAL_BODY,
  CompositionResolver,
  type AppearanceSelection,
} from "../../src/character";

const appearances: readonly AppearanceSelection[] = [
  { identityId: "moss", outfitId: "trail", weaponId: null },
  { identityId: "moss", outfitId: "trail", weaponId: "wooden-sword" },
  { identityId: "moss", outfitId: "hoodie", weaponId: null },
  { identityId: "moss", outfitId: "hoodie", weaponId: "wooden-sword" },
  { identityId: "bramble", outfitId: "trail", weaponId: null },
  { identityId: "bramble", outfitId: "trail", weaponId: "wooden-sword" },
  { identityId: "bramble", outfitId: "hoodie", weaponId: null },
  { identityId: "bramble", outfitId: "hoodie", weaponId: "wooden-sword" },
];

describe("authored pose presentation bundles", () => {
  it("covers all 168 appearance and animation-frame compositions deterministically", () => {
    const resolver = new CompositionResolver();
    const presentationIds = new Set<string>();
    let checked = 0;

    for (const appearance of appearances) {
      for (const animationId of ANIMATION_IDS) {
        CANONICAL_BODY.animations[animationId].frames.forEach((_frame, frameIndex) => {
          const first = resolver.resolve({ appearance, animationId, frameIndex });
          const second = resolver.resolve({ appearance, animationId, frameIndex });
          const presentation = first.presentationPiece;

          expect(first.appearance).toEqual(appearance);
          expect(Object.isFrozen(first.appearance)).toBe(true);
          expect(presentation?.kind).toBe("raster");
          expect(second.presentationPiece).toBe(presentation);
          expect(presentation?.sourceRect?.width).toBeGreaterThan(0);
          expect(presentation?.sourceRect?.height).toBeGreaterThan(0);
          expect(
            presentation!.bounds.height / presentation!.sourceRect!.height,
          ).toBeGreaterThanOrEqual(2 / 3);
          expect(
            presentation!.bounds.height / presentation!.sourceRect!.height,
          ).toBeLessThan(0.674);

          presentationIds.add(presentation!.id);
          checked += 1;
        });
      }
    }

    expect(checked).toBe(168);
    expect(presentationIds.size).toBe(168);
    expect(AUTHORED_PRESENTATION_PIECES).toHaveLength(168);
  });

  it("selects six dedicated run cells and the intended attack cells", () => {
    const resolver = new CompositionResolver();
    const armed = appearances[1]!;
    const unarmed = appearances[0]!;

    const rects = (appearance: AppearanceSelection, animationId: "run" | "attack") =>
      CANONICAL_BODY.animations[animationId].frames.map((_frame, frameIndex) => {
        const piece = resolver.resolve({ appearance, animationId, frameIndex }).presentationPiece!;
        return {
          source: piece.source,
          x: piece.sourceRect!.x,
          y: piece.sourceRect!.y,
        };
      });

    expect(rects(armed, "run")).toEqual([
      { source: "/assets/character/v2/moss-trail-run-armed.png", x: 0, y: 0 },
      { source: "/assets/character/v2/moss-trail-run-armed.png", x: 512, y: 0 },
      { source: "/assets/character/v2/moss-trail-run-armed.png", x: 1024, y: 0 },
      { source: "/assets/character/v2/moss-trail-run-armed.png", x: 0, y: 512 },
      { source: "/assets/character/v2/moss-trail-run-armed.png", x: 512, y: 512 },
      { source: "/assets/character/v2/moss-trail-run-armed.png", x: 1024, y: 512 },
    ]);

    expect(rects(unarmed, "run").map(({ source }) => source)).toEqual(
      Array(6).fill("/assets/character/v2/moss-trail-run-unarmed.png"),
    );

    expect(rects(armed, "attack")).toEqual([
      { source: "/assets/character/v2/moss-trail-attack.png", x: 0, y: 0 },
      { source: "/assets/character/v2/moss-trail-attack.png", x: 512, y: 0 },
      { source: "/assets/character/v2/moss-trail-attack.png", x: 1024, y: 0 },
      { source: "/assets/character/v2/moss-trail-attack.png", x: 0, y: 512 },
      { source: "/assets/character/v2/moss-trail-attack.png", x: 512, y: 512 },
      { source: "/assets/character/v2/moss-trail-attack.png", x: 1024, y: 512 },
    ]);

    expect(rects(unarmed, "attack")).toEqual([
      { source: "/assets/character/v2/moss-trail-unarmed.png", x: 1024, y: 512 },
      { source: "/assets/character/v2/moss-trail-unarmed.png", x: 512, y: 0 },
      { source: "/assets/character/v2/moss-trail-unarmed.png", x: 1024, y: 0 },
      { source: "/assets/character/v2/moss-trail-unarmed.png", x: 1024, y: 512 },
      { source: "/assets/character/v2/moss-trail-unarmed.png", x: 512, y: 512 },
      { source: "/assets/character/v2/moss-trail-unarmed.png", x: 0, y: 0 },
    ]);

    const idle = resolver.resolve({ appearance: armed, animationId: "idle", frameIndex: 0 })
      .presentationPiece!;
    const land = resolver.resolve({ appearance: armed, animationId: "land", frameIndex: 0 })
      .presentationPiece!;
    const attackContact = resolver.resolve({
      appearance: armed,
      animationId: "attack",
      frameIndex: 3,
    }).presentationPiece!;

    expect(idle.bounds.y + idle.bounds.height).toBeCloseTo(0, 8);
    expect(land.bounds.y + land.bounds.height).toBeCloseTo(0, 8);
    expect(attackContact.bounds.y + attackContact.bounds.height).toBeCloseTo(0, 8);
  });
});
