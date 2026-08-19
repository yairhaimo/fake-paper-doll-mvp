import { describe, expect, it } from 'vitest';

import {
  ANIMATION_IDS,
  CANONICAL_BODY,
  DEFAULT_CHARACTER_CATALOG,
  assertValidCharacterSystem,
  validateCharacterSystem,
} from '../../src/character';

describe('character-system validation', () => {
  it('validates the canonical catalog and every with/without-weapon combination', () => {
    const report = validateCharacterSystem();
    const totalFrames = ANIMATION_IDS.reduce(
      (sum, animationId) =>
        sum + CANONICAL_BODY.animations[animationId].frames.length,
      0,
    );
    const expected =
      DEFAULT_CHARACTER_CATALOG.identities.size *
      DEFAULT_CHARACTER_CATALOG.outfits.size *
      (DEFAULT_CHARACTER_CATALOG.weapons.size + 1) *
      totalFrames;

    expect(report.valid).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.checkedCompositions).toBe(expected);
    expect(() => assertValidCharacterSystem()).not.toThrow();
  });

  it('reports every missing referenced asset', () => {
    const assets = new Map(DEFAULT_CHARACTER_CATALOG.assets);
    const assetId = DEFAULT_CHARACTER_CATALOG.outfits
      .get('hoodie')!
      .pieces.run[3]!.frontArm!;
    assets.delete(assetId);
    const report = validateCharacterSystem({
      ...DEFAULT_CHARACTER_CATALOG,
      assets,
    });

    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'MISSING_ASSET')).toBe(true);
    expect(
      report.issues.some((issue) => issue.code === 'COMPOSITION_MISSING_ASSET'),
    ).toBe(true);
  });

  it('ensures important anatomy and clothing contours are pose-specific', () => {
    const providers = [
      ...DEFAULT_CHARACTER_CATALOG.identities.values(),
      ...DEFAULT_CHARACTER_CATALOG.outfits.values(),
    ];
    const poseLayers = ['rearArm', 'frontArm', 'rearFoot', 'frontFoot'] as const;

    for (const provider of providers) {
      for (const animationId of ANIMATION_IDS) {
        provider.pieces[animationId].forEach((pieceSet, frameIndex) => {
          const frameId = `${animationId}_${frameIndex}`;
          for (const layer of poseLayers) {
            const assetId = pieceSet[layer];
            if (assetId === undefined) continue;
            const asset = DEFAULT_CHARACTER_CATALOG.assets.get(assetId)!;
            expect(asset.shapeKey).toContain(frameId);
            expect(asset.tags).toContain('pose-specific');
          }
        });
      }
    }
  });

  it('keeps every frame on the same canonical root and ground', () => {
    for (const animationId of ANIMATION_IDS) {
      for (const frame of CANONICAL_BODY.animations[animationId].frames) {
        expect(frame.rootOrigin).toEqual({ x: 128, y: 232 });
        expect(frame.anchors.root).toEqual(frame.rootOrigin);
        expect(frame.groundY).toBe(232);
      }
    }
  });
});
