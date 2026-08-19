import { describe, expect, it, vi } from 'vitest';

import {
  AnimationPlayer,
  AppearanceStore,
  AppearanceSwapError,
  CompositionResolver,
  DEFAULT_CHARACTER_CATALOG,
  createSimulationState,
  stepSimulation,
} from '../../src/character';

describe('AppearanceStore atomic swaps', () => {
  it('preserves position, facing, velocity and run animation progress', () => {
    const store = new AppearanceStore();
    const player = new AnimationPlayer('run');
    player.seekFrame(3, 2);
    let simulation = createSimulationState({
      position: { x: 417, y: 360 },
      velocity: { x: -3, y: 0 },
      facing: -1,
    });
    simulation = stepSimulation(simulation, {
      horizontal: -1,
      jumpPressed: false,
    });
    const simulationBefore = structuredClone(simulation);
    const animationBefore = player.snapshot();
    const compositionBefore = new CompositionResolver().resolvePlayer(
      store.selection,
      animationBefore,
      simulation.facing,
    );

    store.swap({ identityId: 'bramble', outfitId: 'hoodie' });

    expect(simulation).toEqual(simulationBefore);
    expect(player.snapshot()).toEqual(animationBefore);
    const compositionAfter = new CompositionResolver().resolvePlayer(
      store.selection,
      player.snapshot(),
      simulation.facing,
    );
    expect(compositionAfter.frameId).toBe('run_3');
    expect(compositionAfter.signature).not.toBe(compositionBefore.signature);
  });

  it('preserves attack recovery timing when identity, outfit, and gear change', () => {
    const store = new AppearanceStore();
    const player = new AnimationPlayer('attack');
    player.seekFrame(5, 3);
    const simulation = createSimulationState({
      position: { x: 719, y: 360 },
      velocity: { x: 2, y: 0 },
      facing: 1,
      tick: 820,
    });
    const beforePlayer = player.snapshot();
    const beforeSimulation = structuredClone(simulation);

    store.swap({
      identityId: 'bramble',
      outfitId: 'hoodie',
      weaponId: null,
    });

    expect(player.snapshot()).toEqual(beforePlayer);
    expect(simulation).toEqual(beforeSimulation);
    expect(player.snapshot()).toMatchObject({
      animationId: 'attack',
      frameId: 'attack_5',
      ticksIntoFrame: 3,
    });
  });

  it('does not commit or notify when validation fails', () => {
    const store = new AppearanceStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.snapshot;

    expect(() => store.swap({ outfitId: 'missing-coat' })).toThrow(
      AppearanceSwapError,
    );
    expect(store.snapshot).toBe(before);
    expect(store.snapshot.revision).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('validates full animation coverage before the single commit', () => {
    const assets = new Map(DEFAULT_CHARACTER_CATALOG.assets);
    const missingRecoverySleeve = DEFAULT_CHARACTER_CATALOG.outfits
      .get('hoodie')!
      .pieces.attack[5]!.frontArm!;
    assets.delete(missingRecoverySleeve);
    const catalog = { ...DEFAULT_CHARACTER_CATALOG, assets };
    const store = new AppearanceStore(
      { identityId: 'moss', outfitId: 'trail', weaponId: 'wooden-sword' },
      catalog,
    );
    const before = store.snapshot;

    expect(() => store.swap({ outfitId: 'hoodie' })).toThrow(/not renderable/);
    expect(store.snapshot).toBe(before);
  });

  it('increments revision once for a multi-slot transaction', () => {
    const store = new AppearanceStore();
    const result = store.swap({ identityId: 'bramble', outfitId: 'hoodie' });

    expect(result.changed).toBe(true);
    expect(result.previous.revision).toBe(0);
    expect(result.current.revision).toBe(1);
    expect(store.snapshot.revision).toBe(1);
  });
});
