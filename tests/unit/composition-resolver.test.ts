import { describe, expect, it } from 'vitest';

import {
  ANIMATION_IDS,
  CANONICAL_BODY,
  CompositionResolver,
  DEFAULT_CHARACTER_CATALOG,
  SEMANTIC_LAYERS,
  type AppearanceSelection,
} from '../../src/character';

const appearances: AppearanceSelection[] = [
  { identityId: 'moss', outfitId: 'trail', weaponId: 'wooden-sword' },
  { identityId: 'moss', outfitId: 'hoodie', weaponId: 'wooden-sword' },
  { identityId: 'bramble', outfitId: 'trail', weaponId: 'wooden-sword' },
  { identityId: 'bramble', outfitId: 'hoodie', weaponId: 'wooden-sword' },
];

describe('CompositionResolver', () => {
  it('resolves every identity/outfit combination for every authored frame', () => {
    const resolver = new CompositionResolver();

    for (const appearance of appearances) {
      for (const animationId of ANIMATION_IDS) {
        CANONICAL_BODY.animations[animationId].frames.forEach((_frame, frameIndex) => {
          const result = resolver.resolve({ appearance, animationId, frameIndex });
          expect(result.drawCommands.length).toBeGreaterThan(10);
          expect(result.frameId).toBe(`${animationId}_${frameIndex}`);
          expect(result.signature).toMatch(/^[0-9a-f]{8}$/);
        });
      }
    }
  });

  it('returns a byte-stable semantic trace and signature', () => {
    const resolver = new CompositionResolver();
    const request = {
      appearance: appearances[3]!,
      animationId: 'attack' as const,
      frameIndex: 4,
      facing: -1 as const,
    };

    const first = resolver.resolve(request);
    const second = resolver.resolve(request);

    expect(second.trace).toEqual(first.trace);
    expect(second.signature).toBe(first.signature);
    expect(JSON.stringify(second.drawCommands)).toBe(
      JSON.stringify(first.drawCommands),
    );
  });

  it('applies explicit clothing and weapon replacement rules', () => {
    const result = new CompositionResolver().resolve({
      appearance: appearances[1]!,
      animationId: 'attack',
      frameIndex: 3,
    });
    const byLayer = new Map(result.drawCommands.map((command) => [command.layer, command]));

    expect(result.hiddenLayers).toContain('body');
    expect(result.replacedLayers).toEqual(
      expect.arrayContaining(['rearArm', 'frontArm', 'rearFoot', 'frontFoot', 'frontHand']),
    );
    expect(byLayer.get('frontArm')?.providerId).toBe('hoodie');
    expect(byLayer.get('frontHand')?.providerId).toBe('wooden-sword');
    expect(byLayer.has('weaponFront')).toBe(true);
    expect(byLayer.has('weaponBack')).toBe(false);
  });

  it('authors attack_3 as a whole-body contact pose with a clean grip sandwich', () => {
    const resolver = new CompositionResolver();

    for (const appearance of appearances) {
      const result = resolver.resolve({
        appearance,
        animationId: 'attack',
        frameIndex: 3,
      });
      const anchors = result.anchors;
      const weapon = result.drawCommands.find(
        (command) => command.layer === 'weaponFront',
      )!;
      const grip = result.drawCommands.find(
        (command) => command.layer === 'frontHand',
      )!;
      const blade = weapon.asset.primitives.find(
        (primitive) => primitive.kind === 'polygon',
      );

      expect(anchors.neck.x - anchors.waist.x).toBeGreaterThanOrEqual(18);
      expect(anchors.footFront.x - anchors.footRear.x).toBeGreaterThanOrEqual(75);
      expect(anchors.shoulderRear.x - anchors.handRear.x).toBeGreaterThanOrEqual(40);
      expect(anchors.weaponGrip).toEqual(anchors.handFront);
      expect(weapon.ordinal).toBeLessThan(grip.ordinal);
      expect(blade?.kind).toBe('polygon');
      if (blade?.kind === 'polygon') {
        const worldTipX = Math.max(
          ...blade.points.map((point) => point.x + weapon.anchor.x),
        );
        expect(worldTipX).toBeLessThanOrEqual(248);
      }
    }
  });

  it('authors run_3 as unmistakable single-support locomotion in both facings', () => {
    const resolver = new CompositionResolver();

    for (const appearance of appearances) {
      for (const facing of [-1, 1] as const) {
        const result = resolver.resolve({
          appearance,
          animationId: 'run',
          frameIndex: 3,
          facing,
        });
        const anchors = result.anchors;
        const weapon = result.drawCommands.find(
          (command) => command.layer === 'weaponBack',
        )!;
        const grip = result.drawCommands.find(
          (command) => command.layer === 'frontHand',
        )!;
        const blade = weapon.asset.primitives.find(
          (primitive) => primitive.kind === 'polygon',
        );

        expect(anchors.footFront.y).toBe(230);
        expect(anchors.footFront.y - anchors.footRear.y).toBeGreaterThanOrEqual(25);
        expect(anchors.neck.x - anchors.waist.x).toBeGreaterThanOrEqual(10);
        expect(anchors.handRear.x - anchors.shoulderRear.x).toBeGreaterThanOrEqual(45);
        expect(anchors.shoulderFront.x - anchors.handFront.x).toBeGreaterThanOrEqual(45);
        expect(anchors.weaponGrip).toEqual(anchors.handFront);
        expect(weapon.ordinal).toBeLessThan(grip.ordinal);

        expect(blade?.kind).toBe('polygon');
        if (blade?.kind === 'polygon') {
          const authoredXs = blade.points.map(
            (point) => point.x + weapon.anchor.x,
          );
          const facingXs = authoredXs.map((x) =>
            facing === 1 ? x : result.rootOrigin.x * 2 - x,
          );
          expect(Math.min(...facingXs)).toBeGreaterThanOrEqual(8);
          expect(Math.max(...facingXs)).toBeLessThanOrEqual(248);
        }
      }
    }
  });

  it('emits commands in the current frame semantic order', () => {
    const result = new CompositionResolver().resolve({
      appearance: appearances[0]!,
      animationId: 'run',
      frameIndex: 3,
    });
    const ordinals = result.drawCommands.map((command) =>
      SEMANTIC_LAYERS.indexOf(command.layer),
    );
    expect(ordinals).toEqual([...ordinals].sort((a, b) => a - b));
    expect(result.drawCommands.map((command) => command.ordinal)).toEqual(
      result.drawCommands.map((_command, index) => index),
    );
  });

  it('uses local-to-anchor vector coordinates consistently', () => {
    const result = new CompositionResolver().resolve({
      appearance: appearances[2]!,
      animationId: 'run',
      frameIndex: 3,
    });

    for (const command of result.drawCommands) {
      expect(command.anchor).toBe(result.anchors[command.anchorName]);
      expect(command.asset.attachmentAnchor).toBe(command.anchorName);
      expect(command.asset.primitives.length).toBeGreaterThan(0);
    }
  });

  it('changes facing in the signature without changing authored pieces', () => {
    const resolver = new CompositionResolver();
    const base = {
      appearance: appearances[0]!,
      animationId: 'idle' as const,
      frameIndex: 0,
    };
    const right = resolver.resolve({ ...base, facing: 1 });
    const left = resolver.resolve({ ...base, facing: -1 });

    expect(left.signature).not.toBe(right.signature);
    expect(left.drawCommands.map((command) => command.assetId)).toEqual(
      right.drawCommands.map((command) => command.assetId),
    );
  });

  it('fails loudly when an asset is absent', () => {
    const assets = new Map(DEFAULT_CHARACTER_CATALOG.assets);
    const missingId = DEFAULT_CHARACTER_CATALOG.outfits
      .get('hoodie')!
      .pieces.attack[3]!.frontArm!;
    assets.delete(missingId);
    const catalog = { ...DEFAULT_CHARACTER_CATALOG, assets };
    const resolver = new CompositionResolver(catalog);

    expect(() =>
      resolver.resolve({
        appearance: appearances[3]!,
        animationId: 'attack',
        frameIndex: 3,
      }),
    ).toThrow(/does not exist/);
  });
});
