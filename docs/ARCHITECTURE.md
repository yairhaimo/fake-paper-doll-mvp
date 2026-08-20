# Architecture

Softwood separates gameplay time from appearance. `GameLab` coordinates the browser loop and UI, but each stage owns one kind of state and exposes an explicit hand-off:

`Simulation → AnimationPlayer → AppearanceStore → pure CompositionResolver → persistent Pixi CharacterView`

The view has two presentation paths. Normal play draws a preloaded authored raster pose selected from the resolved appearance and frame. Layer-debug mode draws the underlying semantic command stack with cached vector geometry. Both paths share the same root, facing, timing, anchors, and appearance transaction.

The arrow describes the runtime assembly path, not shared ownership. In particular, `AppearanceStore` does not drive or mutate `AnimationPlayer`; the coordinator supplies independent animation and appearance snapshots to the resolver.

## Boundaries

| Boundary | Owns | Does not own |
| --- | --- | --- |
| `simulation.ts` | World root position, velocity, facing, grounded state, and monotonically increasing integer tick. | Appearance, authored frames, or rendering. |
| `AnimationPlayer` | Animation ID, integer animation tick, frame selection, loop count, one-shot completion, and deterministic seek/step operations. | World movement or appearance. |
| `AppearanceStore` | `identityId`, `outfitId`, nullable `weaponId`, and revision. Commits only fully validated candidates. | Simulation or animation time. |
| `CompositionResolver` | Pure selection of palette, hidden/replaced layers, ordered semantic draw commands, trace/signature, and optional authored presentation piece for one frame. | DOM, PixiJS, clocks, or mutable runtime state. |
| `VectorCharacterView` | Stable Pixi containers, pooled `Sprite`/`Graphics` slots, texture preloading, vector fallback, and anchor labels. | Catalog rules, frame selection, or gameplay. |

Supporting boundaries are `canonicalBody.ts` for the body/animation contract, `registries.ts` and `vectorAssets.ts` for content, `validation.ts` for exhaustive integrity checks, and `InputController` for browser input edges.

`authoredPoseBundles.ts` is the deliberately narrow art adapter for this vertical slice. It maps the four identity/outfit pairs, sword on/off, six animations, and 21 frame IDs to fixed atlas cells without taking ownership of simulation or composition rules.

## Fixed-step coordination

`GameLab` converts Pixi ticker milliseconds into 60 Hz steps using an accumulator capped at five ticks. Each fixed step:

1. reads held/pressed movement intent;
2. advances the immutable simulation state;
3. selects locomotion with `deriveLocomotionAnimation`, unless manual animation preview, attack, or landing owns the animation;
4. advances `AnimationPlayer` by one integer tick;

After zero or more fixed steps, the outer Pixi ticker calls `render()` once. That pass resolves a new composition only when appearance revision, animation/frame, or facing changed, then renders it at the simulation’s world root. Rendering therefore follows the ticker rather than occurring inside every catch-up step.

`attack` and `land` are clamped one-shots. `idle`, `run`, and `fall` loop; `jump` is also authored as a one-shot, with locomotion switching to `fall` when vertical velocity changes sign. Pausing and the compatibility gallery stop fixed-step advancement. Frame metrics continue to sample the Pixi ticker.

## Canonical and world coordinates

The body contract is version 1 on a 256 × 256 logical canvas:

- root origin: `(128, 232)`;
- ground line and `ground` anchor: `y = 232`;
- all frames keep `anchors.root === rootOrigin` and the same ground line;
- unarmed envelope: `{ x: 67, y: 30, width: 123, height: 202 }`;
- weapon envelope: `{ x: 8, y: 8, width: 240, height: 236 }`.

Frame anchors are canonical coordinates and may move with a pose; positive x points right and positive y points down. Asset geometry is local to its `attachmentAnchor`; the view places a piece at:

```text
anchor - rootOrigin + optional asset offset
```

The stable character container is then positioned at the simulation root in the 960 × 540 world. Grounded world `y` is `444`. Facing is a horizontal scale of `1` or `-1` on a child container, so left and right share the same authored pieces and root.

Runtime atlas cells are 512 × 512. A presentation descriptor maps a cell at `2/3` logical scale with its bottom center pinned to the canonical root, yielding an approximately 220-logical-pixel painted character while preserving the same foot-ground contract and mirror origin.

## Composition rules

Resolution is deterministic and has fixed precedence:

1. identity pieces populate semantic layer slots;
2. outfit `hideLayers` remove earlier pieces, then outfit pieces replace only declared `replaceLayers`;
3. an equipped weapon applies the same explicit rules;
4. optional frame `hiddenLayers` remove final slots;
5. surviving pieces are emitted in the frame’s semantic `layerOrder`.

Current outfits hide `body` and explicitly replace `rearArm`, `frontArm`, `rearFoot`, and `frontFoot`. `wooden-sword` explicitly replaces `frontHand`. Providing a piece for an occupied layer without permission raises `IMPLICIT_LAYER_COLLISION`; there is no implicit fallback or overwrite. A resolved asset must exist, declare the same layer, attach to a present anchor, and occur in the frame draw order.

Palette precedence mirrors provider precedence: shared, identity, outfit, then weapon. The result records layers actually removed or overwritten in canonical semantic order.

The default order for the 23 semantic slots, from back to front, is:

```text
groundShadow, tailBack, weaponBack, earBack, tuftBack,
rearFoot, rearLeg, rearArm, rearHand, body, topBack, head, face,
bottoms, frontLeg, frontFoot, top, frontArm, frontHand, tuftFront,
hoodOrHatFront, weaponFront, accessoryFront
```

Frames may deliberately override that order without changing the layer vocabulary. `attack_2` and `attack_4` move `weaponFront` to the very end for a clear swing silhouette; `attack_3` places `weaponFront` immediately before `frontHand` so the authored grip covers the handle.

## Atomic appearance swaps

`AppearanceStore.swap()` builds a candidate without writing state. `validateAppearanceSelection()` first checks registry IDs, then resolves the candidate across all 21 frames. Only after all resolutions succeed does the store publish one frozen snapshot with `revision + 1` and notify listeners. A failed swap retains object identity, revision, and selection.

Because neither `SimulationState` nor `AnimationPlayer` is reachable from `AppearanceStore`, a swap cannot reset position, velocity, facing, tick, animation/frame, elapsed ticks, or one-shot recovery. `GameLab` checks this invariant around every interactive swap, and unit/end-to-end tests assert it during run and attack recovery.

## Persistent rendering

`VectorCharacterView` creates its root, facing, piece, and anchor containers once. Each reusable slot owns both a Pixi `Sprite` and `Graphics`; the active backend is toggled without rebuilding the character tree. World position remains on the root container while facing remains on the child container.

`GameLab` preloads both catalog assets and all authored presentation descriptors before the first playable frame. Source sheets and cropped textures are cached by deterministic source/crop keys. If a presentation texture is unavailable, the view requests it and renders the complete semantic stack instead of leaving a blank character. Layer-debug mode always selects the semantic stack so hide/replace and draw-order inspection remain meaningful.

Vector contexts are cached globally by `asset.id` plus a key-sorted palette. The ticker still invokes the view, but piece-pool and context updates are skipped when the semantic signature, frame ID, layer-debug state, and presentation readiness are unchanged. Anchor geometry is rebuilt only when anchor debug is visible and the frame changes. Gallery cards each own another persistent view and use the same resolver contract.

## Determinism and observability

- Frame durations, simulation ticks, seek offsets, and player deltas are integers. Fractional animation time is rejected.
- Stable frame IDs use `<animationId>_<zero-based frameIndex>`.
- The resolver iterates declared arrays rather than object insertion order for semantic ordering.
- Each trace row includes ordinal, layer, provider, asset, anchor name, and anchor coordinates.
- An eight-character FNV-1a signature covers animation/frame, facing, hidden/replaced layers, and the trace. It is a semantic digest, not pixel output.
- `window.__PAPER_DOLL__` exposes snapshots and deterministic controls for Playwright: pause, tick stepping, animation selection, debug toggles, appearance swaps, invariant checks, and frame metrics.

## Constraints and extension points

The semantic catalog is code-authored; the polished presentation is generated at build time from controlled painted source sheets. Presentation bundles are full-pose loadout/frame images, so they prove the visual and state-preservation slice but do not yet permit arbitrary new wardrobe combinations without new paintings. Catalog IDs, bundle matrices, the inspector, cycle arrays, combination counter, and gallery are partly hard-coded. There is one outfit and one nullable weapon selection, no runtime schema migration, and no interpolation between authored frames. The signature remains semantic rather than a texture-byte digest.

Near-term architectural work should split the accepted paintings into semantic raster underlaps and export a generated, versioned atlas manifest. Registries can then drive UI/gallery enumeration while the renderer keeps the same sprite pool, explicit hide/replace rules, and fallback path. Extensible slots, cache lifecycle policy, and target-device profiling follow.
