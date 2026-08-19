import { CANONICAL_BODY } from './canonicalBody';
import { CompositionError, CompositionResolver } from './compositionResolver';
import { DEFAULT_APPEARANCE, DEFAULT_CHARACTER_CATALOG } from './registries';
import {
  ANIMATION_IDS,
  type AppearanceSelection,
  type AppearanceSnapshot,
  type CharacterCatalog,
} from './types';

export interface AppearancePatch {
  readonly identityId?: string | undefined;
  readonly outfitId?: string | undefined;
  readonly weaponId?: string | null | undefined;
}

export interface AppearanceSwapResult {
  readonly changed: boolean;
  readonly previous: AppearanceSnapshot;
  readonly current: AppearanceSnapshot;
}

export type AppearanceListener = (
  current: AppearanceSnapshot,
  previous: AppearanceSnapshot,
) => void;

export class AppearanceSwapError extends Error {
  readonly code: string;
  readonly attempted: AppearanceSelection;
  readonly cause: unknown;

  constructor(
    code: string,
    message: string,
    attempted: AppearanceSelection,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'AppearanceSwapError';
    this.code = code;
    this.attempted = Object.freeze({ ...attempted });
    this.cause = cause;
  }
}

function snapshotFrom(
  selection: AppearanceSelection,
  revision: number,
): AppearanceSnapshot {
  return Object.freeze({ ...selection, revision });
}

export function validateAppearanceSelection(
  selection: AppearanceSelection,
  catalog: CharacterCatalog = DEFAULT_CHARACTER_CATALOG,
): void {
  if (!catalog.identities.has(selection.identityId)) {
    throw new AppearanceSwapError(
      'UNKNOWN_IDENTITY',
      `Unknown identity ID: ${selection.identityId}`,
      selection,
    );
  }
  if (!catalog.outfits.has(selection.outfitId)) {
    throw new AppearanceSwapError(
      'UNKNOWN_OUTFIT',
      `Unknown outfit ID: ${selection.outfitId}`,
      selection,
    );
  }
  if (selection.weaponId !== null && !catalog.weapons.has(selection.weaponId)) {
    throw new AppearanceSwapError(
      'UNKNOWN_WEAPON',
      `Unknown weapon ID: ${selection.weaponId}`,
      selection,
    );
  }

  // A swap is committed only when the candidate resolves for every authored
  // animation/frame. This catches a wardrobe asset that happens to look fine in
  // idle but is missing its attack recovery sleeve.
  const resolver = new CompositionResolver(catalog);
  try {
    for (const animationId of ANIMATION_IDS) {
      const frameCount = CANONICAL_BODY.animations[animationId].frames.length;
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        resolver.resolve({ appearance: selection, animationId, frameIndex });
      }
    }
  } catch (error) {
    const code =
      error instanceof CompositionError
        ? `INVALID_COMPOSITION_${error.code}`
        : 'INVALID_COMPOSITION';
    throw new AppearanceSwapError(
      code,
      `Appearance ${selection.identityId}/${selection.outfitId}/${selection.weaponId ?? 'none'} is not renderable`,
      selection,
      error,
    );
  }
}

/**
 * Appearance-only state container. It cannot mutate simulation or animation
 * state by construction, which is the central swap-preservation guarantee.
 */
export class AppearanceStore {
  readonly catalog: CharacterCatalog;
  #snapshot: AppearanceSnapshot;
  readonly #listeners = new Set<AppearanceListener>();

  constructor(
    initial: AppearanceSelection = DEFAULT_APPEARANCE,
    catalog: CharacterCatalog = DEFAULT_CHARACTER_CATALOG,
  ) {
    this.catalog = catalog;
    validateAppearanceSelection(initial, catalog);
    this.#snapshot = snapshotFrom(initial, 0);
  }

  get snapshot(): AppearanceSnapshot {
    return this.#snapshot;
  }

  get selection(): AppearanceSelection {
    const { identityId, outfitId, weaponId } = this.#snapshot;
    return Object.freeze({ identityId, outfitId, weaponId });
  }

  swap(patch: AppearancePatch): AppearanceSwapResult {
    const previous = this.#snapshot;
    const candidate: AppearanceSelection = Object.freeze({
      identityId: patch.identityId ?? previous.identityId,
      outfitId: patch.outfitId ?? previous.outfitId,
      weaponId: patch.weaponId === undefined ? previous.weaponId : patch.weaponId,
    });

    const changed =
      candidate.identityId !== previous.identityId ||
      candidate.outfitId !== previous.outfitId ||
      candidate.weaponId !== previous.weaponId;
    if (!changed) {
      return Object.freeze({ changed: false, previous, current: previous });
    }

    // Validate before the only write. Any error leaves #snapshot untouched.
    validateAppearanceSelection(candidate, this.catalog);
    const current = snapshotFrom(candidate, previous.revision + 1);
    this.#snapshot = current;

    for (const listener of this.#listeners) listener(current, previous);
    return Object.freeze({ changed: true, previous, current });
  }

  subscribe(listener: AppearanceListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
