import type { AnimationId, Facing, Point } from './types';

export interface SimulationState {
  /** Root position in world logical pixels. */
  readonly position: Point;
  /** Logical pixels per simulation tick. */
  readonly velocity: Point;
  readonly facing: Facing;
  readonly grounded: boolean;
  readonly tick: number;
}

export interface MovementIntent {
  readonly horizontal: -1 | 0 | 1;
  readonly jumpPressed: boolean;
}

export interface SimulationConfig {
  readonly groundY: number;
  readonly horizontalSpeed: number;
  readonly horizontalAcceleration: number;
  readonly jumpImpulse: number;
  readonly gravity: number;
  readonly maxFallSpeed: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = Object.freeze({
  groundY: 360,
  horizontalSpeed: 4,
  horizontalAcceleration: 1,
  jumpImpulse: -11,
  gravity: 1,
  maxFallSpeed: 12,
});

function approach(current: number, target: number, amount: number): number {
  if (current < target) return Math.min(current + amount, target);
  if (current > target) return Math.max(current - amount, target);
  return current;
}

function assertFinitePoint(point: Point, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${label} must contain finite coordinates`);
  }
}

export function createSimulationState(
  overrides: Partial<Omit<SimulationState, 'position' | 'velocity'>> & {
    readonly position?: Point;
    readonly velocity?: Point;
  } = {},
): SimulationState {
  const position = overrides.position ?? { x: 320, y: DEFAULT_SIMULATION_CONFIG.groundY };
  const velocity = overrides.velocity ?? { x: 0, y: 0 };
  assertFinitePoint(position, 'position');
  assertFinitePoint(velocity, 'velocity');

  return Object.freeze({
    position: Object.freeze({ ...position }),
    velocity: Object.freeze({ ...velocity }),
    facing: overrides.facing ?? 1,
    grounded: overrides.grounded ?? true,
    tick: overrides.tick ?? 0,
  });
}

/** A small deterministic side-view movement model used by the vertical slice. */
export function stepSimulation(
  state: SimulationState,
  intent: MovementIntent,
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG,
): SimulationState {
  if (![-1, 0, 1].includes(intent.horizontal)) {
    throw new RangeError(`horizontal intent must be -1, 0, or 1`);
  }

  const targetX = intent.horizontal * config.horizontalSpeed;
  const velocityX = approach(
    state.velocity.x,
    targetX,
    config.horizontalAcceleration,
  );
  let velocityY = state.velocity.y;
  let grounded = state.grounded;

  if (intent.jumpPressed && grounded) {
    velocityY = config.jumpImpulse;
    grounded = false;
  } else if (!grounded) {
    velocityY = Math.min(config.maxFallSpeed, velocityY + config.gravity);
  }

  const positionX = state.position.x + velocityX;
  let positionY = state.position.y + velocityY;

  if (!grounded && positionY >= config.groundY) {
    positionY = config.groundY;
    velocityY = 0;
    grounded = true;
  }

  const facing: Facing =
    intent.horizontal === 0 ? state.facing : intent.horizontal > 0 ? 1 : -1;

  return Object.freeze({
    position: Object.freeze({ x: positionX, y: positionY }),
    velocity: Object.freeze({ x: velocityX, y: velocityY }),
    facing,
    grounded,
    tick: state.tick + 1,
  });
}

export function deriveLocomotionAnimation(
  previous: SimulationState,
  current: SimulationState,
): AnimationId {
  if (!current.grounded) return current.velocity.y < 0 ? 'jump' : 'fall';
  if (!previous.grounded && current.grounded) return 'land';
  return current.velocity.x === 0 ? 'idle' : 'run';
}
