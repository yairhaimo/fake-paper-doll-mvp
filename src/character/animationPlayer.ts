import { CANONICAL_BODY, getAnimation, totalAnimationTicks } from './canonicalBody';
import type { AnimationId, FrameDefinition } from './types';

export interface AnimationPlayerSnapshot {
  readonly animationId: AnimationId;
  readonly animationTick: number;
  readonly frameIndex: number;
  readonly frameId: string;
  readonly ticksIntoFrame: number;
  readonly normalizedFrameProgress: number;
  readonly normalizedAnimationProgress: number;
  readonly cycle: number;
  readonly completed: boolean;
  readonly totalElapsedTicks: number;
}

export interface SetAnimationOptions {
  readonly restart?: boolean;
  readonly preserveNormalizedProgress?: boolean;
}

interface LocatedFrame {
  readonly frame: FrameDefinition;
  readonly frameIndex: number;
  readonly ticksIntoFrame: number;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer; received ${value}`);
  }
}

function locateFrame(animationId: AnimationId, animationTick: number): LocatedFrame {
  const animation = getAnimation(animationId);
  let remaining = animationTick;

  for (let index = 0; index < animation.frames.length; index += 1) {
    const frame = animation.frames[index]!;
    if (remaining < frame.durationTicks) {
      return { frame, frameIndex: index, ticksIntoFrame: remaining };
    }
    remaining -= frame.durationTicks;
  }

  // animationTick is validated by all callers. This protects future custom
  // contracts from producing an undefined frame if their durations are wrong.
  throw new RangeError(
    `Animation tick ${animationTick} cannot be resolved for ${animationId}`,
  );
}

/**
 * Integer-tick animation clock.
 *
 * It owns timing only; changing appearance never touches this object. Keeping
 * time in integer ticks makes frame selection repeatable across frame rates and
 * screenshot runs.
 */
export class AnimationPlayer {
  readonly tickRate = CANONICAL_BODY.tickRate;

  #animationId: AnimationId;
  #animationTick = 0;
  #cycle = 0;
  #completed = false;
  #totalElapsedTicks = 0;

  constructor(animationId: AnimationId = 'idle') {
    this.#animationId = animationId;
  }

  get animationId(): AnimationId {
    return this.#animationId;
  }

  get frame(): FrameDefinition {
    return locateFrame(this.#animationId, this.#animationTick).frame;
  }

  get frameIndex(): number {
    return locateFrame(this.#animationId, this.#animationTick).frameIndex;
  }

  get completed(): boolean {
    return this.#completed;
  }

  tick(deltaTicks = 1): AnimationPlayerSnapshot {
    assertNonNegativeInteger(deltaTicks, 'deltaTicks');
    if (deltaTicks === 0) {
      return this.snapshot();
    }

    const animation = getAnimation(this.#animationId);
    const duration = totalAnimationTicks(this.#animationId);
    this.#totalElapsedTicks += deltaTicks;

    if (animation.loop) {
      const unwrapped = this.#animationTick + deltaTicks;
      this.#cycle += Math.floor(unwrapped / duration);
      this.#animationTick = unwrapped % duration;
      this.#completed = false;
    } else if (!this.#completed) {
      const unwrapped = this.#animationTick + deltaTicks;
      if (unwrapped >= duration) {
        this.#animationTick = duration - 1;
        this.#completed = true;
      } else {
        this.#animationTick = unwrapped;
      }
    }

    return this.snapshot();
  }

  setAnimation(
    animationId: AnimationId,
    options: SetAnimationOptions = {},
  ): AnimationPlayerSnapshot {
    const { restart = false, preserveNormalizedProgress = false } = options;

    if (animationId === this.#animationId && !restart) {
      return this.snapshot();
    }

    const previousProgress = this.snapshot().normalizedAnimationProgress;
    this.#animationId = animationId;
    this.#cycle = 0;
    this.#completed = false;

    if (preserveNormalizedProgress) {
      const duration = totalAnimationTicks(animationId);
      this.#animationTick = Math.min(
        duration - 1,
        Math.floor(previousProgress * duration),
      );
    } else {
      this.#animationTick = 0;
    }

    return this.snapshot();
  }

  /** Debug-tool operation: seek without advancing the simulation clock. */
  seekFrame(frameIndex: number, ticksIntoFrame = 0): AnimationPlayerSnapshot {
    assertNonNegativeInteger(frameIndex, 'frameIndex');
    assertNonNegativeInteger(ticksIntoFrame, 'ticksIntoFrame');

    const animation = getAnimation(this.#animationId);
    const frame = animation.frames[frameIndex];
    if (frame === undefined) {
      throw new RangeError(
        `Frame index ${frameIndex} is outside ${this.#animationId} coverage`,
      );
    }
    if (ticksIntoFrame >= frame.durationTicks) {
      throw new RangeError(
        `ticksIntoFrame ${ticksIntoFrame} exceeds ${frame.id} duration ${frame.durationTicks}`,
      );
    }

    this.#animationTick = animation.frames
      .slice(0, frameIndex)
      .reduce((sum, candidate) => sum + candidate.durationTicks, ticksIntoFrame);
    this.#completed = false;
    return this.snapshot();
  }

  /** Debug-tool operation: wrap or clamp by authored frame rather than time. */
  stepFrame(delta: -1 | 1): AnimationPlayerSnapshot {
    const animation = getAnimation(this.#animationId);
    const current = this.frameIndex;
    let next = current + delta;

    if (animation.loop) {
      next = (next + animation.frames.length) % animation.frames.length;
    } else {
      next = Math.max(0, Math.min(animation.frames.length - 1, next));
    }

    return this.seekFrame(next);
  }

  snapshot(): AnimationPlayerSnapshot {
    const located = locateFrame(this.#animationId, this.#animationTick);
    const duration = totalAnimationTicks(this.#animationId);
    const normalizedFrameProgress =
      located.frame.durationTicks <= 1
        ? 0
        : located.ticksIntoFrame / located.frame.durationTicks;

    return Object.freeze({
      animationId: this.#animationId,
      animationTick: this.#animationTick,
      frameIndex: located.frameIndex,
      frameId: located.frame.id,
      ticksIntoFrame: located.ticksIntoFrame,
      normalizedFrameProgress,
      normalizedAnimationProgress: this.#animationTick / duration,
      cycle: this.#cycle,
      completed: this.#completed,
      totalElapsedTicks: this.#totalElapsedTicks,
    });
  }

  restore(snapshot: AnimationPlayerSnapshot): AnimationPlayerSnapshot {
    assertNonNegativeInteger(snapshot.animationTick, 'animationTick');
    assertNonNegativeInteger(snapshot.cycle, 'cycle');
    assertNonNegativeInteger(snapshot.totalElapsedTicks, 'totalElapsedTicks');

    const duration = totalAnimationTicks(snapshot.animationId);
    if (snapshot.animationTick >= duration) {
      throw new RangeError(
        `animationTick ${snapshot.animationTick} exceeds ${snapshot.animationId} duration`,
      );
    }

    this.#animationId = snapshot.animationId;
    this.#animationTick = snapshot.animationTick;
    this.#cycle = snapshot.cycle;
    this.#completed = snapshot.completed;
    this.#totalElapsedTicks = snapshot.totalElapsedTicks;
    return this.snapshot();
  }
}
