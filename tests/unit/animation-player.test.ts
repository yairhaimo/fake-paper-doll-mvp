import { describe, expect, it } from 'vitest';

import {
  AnimationPlayer,
  CANONICAL_BODY,
  totalAnimationTicks,
} from '../../src/character';

describe('AnimationPlayer', () => {
  it('selects exactly the same frames for the same integer tick stream', () => {
    const left = new AnimationPlayer('run');
    const right = new AnimationPlayer('run');
    const deltas = [1, 4, 5, 2, 13, 30, 1, 99, 0, 7];

    for (const delta of deltas) {
      expect(left.tick(delta)).toEqual(right.tick(delta));
    }
  });

  it('wraps looping animation without losing overflow ticks', () => {
    const player = new AnimationPlayer('run');
    const duration = totalAnimationTicks('run');
    const result = player.tick(duration * 3 + 7);

    expect(result.cycle).toBe(3);
    expect(result.animationTick).toBe(7);
    expect(result.frameId).toBe('run_1');
    expect(result.ticksIntoFrame).toBe(2);
  });

  it('lands gallery tick 17 on the authored single-support run pose', () => {
    const player = new AnimationPlayer('run');
    const stride = player.tick(17);

    expect(stride.frameId).toBe('run_3');
    expect(stride.ticksIntoFrame).toBe(2);
  });

  it('clamps a one-shot attack on its recovery frame', () => {
    const player = new AnimationPlayer('attack');
    const result = player.tick(totalAnimationTicks('attack') + 500);

    expect(result.completed).toBe(true);
    expect(result.frameId).toBe('attack_5');
    expect(result.ticksIntoFrame).toBe(
      CANONICAL_BODY.animations.attack.frames[5]!.durationTicks - 1,
    );
  });

  it('lands visual-test tick 13 on the authored gold strike contact', () => {
    const player = new AnimationPlayer('attack');
    const contact = player.tick(13);

    expect(contact.frameId).toBe('attack_3');
    expect(contact.ticksIntoFrame).toBe(1);
  });

  it('can preserve normalized time when intentionally changing animation', () => {
    const player = new AnimationPlayer('idle');
    player.tick(Math.floor(totalAnimationTicks('idle') * 0.6));
    const before = player.snapshot().normalizedAnimationProgress;
    const after = player.setAnimation('run', {
      preserveNormalizedProgress: true,
    });

    expect(after.animationId).toBe('run');
    expect(after.normalizedAnimationProgress).toBeCloseTo(before, 1);
  });

  it('supports deterministic frame stepping for debug inspection', () => {
    const player = new AnimationPlayer('attack');
    expect(player.seekFrame(4, 2).frameId).toBe('attack_4');
    expect(player.stepFrame(1).frameId).toBe('attack_5');
    expect(player.stepFrame(1).frameId).toBe('attack_5');
    expect(player.stepFrame(-1).frameId).toBe('attack_4');
  });

  it('rejects fractional time', () => {
    const player = new AnimationPlayer();
    expect(() => player.tick(0.5)).toThrow(/integer/);
  });
});
