# Asset pipeline

The current pipeline is intentionally code-authored: no PNG, SVG, atlas, or JSON file is loaded for the character at runtime. The [concept sheet](./concept-sheet.png) is a visual reference; executable geometry lives in TypeScript.

## From pose to pixels

1. `canonicalBody.ts` defines a 256 × 256 frame: stable ID, integer duration, root/ground, all required anchors, semantic layer order, and pose tags.
2. `registries.ts` walks every animation/frame and asks `vectorAssets.ts` to create identity, outfit, and weapon `VectorPieceDescriptor` objects.
3. Each provider stores a frame-indexed `LayerPieceMap` of semantic layer to stable asset ID. The catalog stores the corresponding descriptors in one asset map.
4. During verification, tests or tooling call `validateCharacterSystem()` to check the contract, providers, assets, and every selectable composition. Production startup does not invoke this whole-catalog validator; `AppearanceStore` performs its own full-frame check for the selected loadout.
5. `CompositionResolver` applies explicit hide/replace rules and emits anchor-positioned draw commands.
6. `VectorCharacterView` turns primitives into cached Pixi `GraphicsContext` objects and reuses a persistent graphics pool.

The generated IDs are path-like and pose-specific:

```text
identity/moss/idle_0/frontArm
outfit/hoodie/attack_3/frontArm
weapon/wooden-sword/attack_3/weaponFront
shared/ground-shadow
```

`shapeKey` adds provider, layer, frame ID, and pose tag so diagnostics can distinguish authored contours even when their layer is the same.

## Authoring contract

All character geometry is authored in canonical space around named anchors, with positive x to the right and positive y down. The fixed root is `(128, 232)` and the ground is `y = 232`. The declared weapon envelope `{ x: 8, y: 8, width: 240, height: 236 }` is the authoring target for complete held-item poses; the current validator does not calculate or enforce envelope containment. World placement and left/right mirroring happen later, so do not bake world coordinates or facing into an asset.

A `VectorPieceDescriptor` supplies:

- a globally unique `id` and descriptive `shapeKey`;
- exactly one semantic `layer`;
- one `attachmentAnchor` and optional local `offset`;
- finite local `bounds` coordinates and positive finite width/height;
- one or more `path`, `ellipse`, `roundRect`, `polygon`, or `line` primitives;
- palette tokens rather than literal provider colors;
- optional diagnostic tags.

Primitives are local to their attachment anchor. Arm and leg factories derive bent contours from shoulder/elbow/hand or hip/knee/foot anchor triples. Feet, sleeves, body, face, tufts, and weapon silhouettes use pose tags to choose authored geometry. This is discrete pose authoring, not runtime skeletal deformation or tweening.

### Author or change a pose

1. Add or edit the frame in `canonicalBody.ts`. Preserve `<animationId>_<frameIndex>` IDs, positive integer `durationTicks`, root `(128, 232)`, and ground `232`.
2. Provide every required anchor. Move pose anchors rather than the canonical root; set meaningful pose tags for every channel.
3. Update vector factory logic when the new tag needs a distinct silhouette. Use anchor-relative points and keep bounds conservative.
4. For `rearArm`, `frontArm`, `rearFoot`, and `frontFoot`, keep the frame ID in `shapeKey` and the `pose-specific` tag. Provider validation requires the frame ID in `shapeKey`; the unit suite separately requires the tag.
5. Check both facing directions, sword back/front transitions, layer and anchor overlays, all loadouts, and the visual baselines.

Adding a frame changes required piece-table lengths for every provider. The current builders regenerate all tables from `CANONICAL_BODY`, but every factory must support every layer it declares.

## Add an identity

Identity is the base provider. It currently supplies `groundShadow`, tail, ears, both tufts, arms/hands, legs/feet, body, head, and face.

1. Add the ID, display name, and complete `identity.*` palette to `IDENTITY_CONFIG` in `registries.ts`.
2. Extend the typed identity ID accepted by `createIdentityPiece()` and implement any identity-specific silhouette branches in `vectorAssets.ts`.
3. Register the identity in `createCharacterCatalog()`. `buildIdentity()` will create one piece map per authored frame and reuse `shared/ground-shadow`.
4. Add the choice to the inspector and identity cycle list in `GameLab.ts`; update the combination counter and `GALLERY_COMBINATIONS` if the new identity should appear there.
5. Run the exhaustive validator, unit/end-to-end suites, and visually review every animation with both outfits and sword states.

Keep IDs stable after shipping. Palette values belong to the provider; identity geometry should use `identity.*` or `shared.*` tokens.

## Add an outfit

An outfit is an `EquipmentDefinition` in the `outfit` registry.

1. Add its configuration and `outfit.*` palette in `registries.ts`.
2. Define its `supportedLayers`, `hideLayers`, and `replaceLayers` explicitly. Hiding removes an earlier piece without replacement; replacing authorizes an overwrite only when the new frame map actually supplies that layer.
3. Extend/generalize `createOutfitPiece()` and `buildOutfit()`. The current implementation has typed `trail | hoodie` branches and a hard-coded supported-layer choice, so adding a third outfit requires updating those branches rather than only inserting a map entry.
4. Register it, then update inspector/cycle/gallery enumeration.
5. Confirm full coverage for all 21 frames and review underlaps at shoulders, waist, hands, and feet.

Both current outfits hide identity `body` and replace identity `rearArm`, `frontArm`, `rearFoot`, and `frontFoot`. `trail` supplies six layers; `hoodie` additionally supplies `topBack` and `hoodOrHatFront`. An undeclared collision fails with `IMPLICIT_LAYER_COLLISION`.

## Add a held item

The current schema calls the held-item slot `weapon`; there is no generic item or accessory registry yet. To add another held item within the existing model:

1. Give it a stable weapon registry ID, display name, `weapon.*` palette, and an `EquipmentDefinition` with `slot: "weapon"`.
2. Generalize `buildWeapon()` and `createWeaponPiece()`, which currently emit only `wooden-sword` IDs and geometry.
3. Supply a piece map for every frame. Declare whether the silhouette belongs on `weaponBack` or `weaponFront`, and replace `frontHand` explicitly if the grip pose is item-specific.
4. Register the definition and change the current binary sword UI into item selection if more than one weapon is selectable.
5. Test every pose with and without the item. The current sword uses `weaponFront` for `attack_2` through `attack_4` and `run_3` through `run_5`; all other frames use `weaponBack`. `attack_2` and `attack_4` draw the front weapon last, while `attack_3` draws it immediately before `frontHand` to create the grip sandwich.

Do not put both back and front weapon pieces into one frame unless that is deliberate authored content with non-colliding layer slots.

## Validation and review

| Check | Enforced by |
| --- | --- |
| 256 × 256 canvas, positive integer tick rate/durations, stable frame IDs, fixed root/ground | `validateContract()` and unit tests |
| Complete finite anchors and unique known draw layers | `validateContract()` |
| Unique asset IDs | Registry construction (`addAsset`) |
| Non-empty primitives, finite bounds coordinates, and positive finite width/height | `validateAssets()` |
| Provider animation/frame coverage and declared supported layers | `validateProvider()` |
| Asset existence, layer match, attachment anchor, and draw-order membership | Validator and resolver |
| Frame ID in pose-critical arm/foot `shapeKey`; `pose-specific` tag | `validateProvider()`; unit metadata test |
| Non-conflicting, non-duplicate hide/replace rules | `validateProvider()` |
| Every identity × outfit × weapon on/off × frame composition | `validateCharacterSystem()`; currently 168 resolutions |
| Swap-time full-frame renderability | `validateAppearanceSelection()` before commit |
| Silhouette, layering, anchor placement, and facing | Playwright visual scenarios and manual overlays |

Run `npm run check` before accepting asset changes. Use `npm run test:visual:update` only when the visual change is intended, then inspect every changed baseline rather than treating snapshot regeneration as approval.

## Pipeline limitations and next steps

TypeScript factories provide strong types and deterministic output, but they couple art, runtime code, catalog construction, and UI enumeration. There is no import-time schema check because there is no external import, no automated bounds calculation, no atlas, and no cache eviction. First-use vector triangulation is warmed before the performance measurement.

A production pipeline should export versioned metadata and vector sources into these same contracts, validate before bundling, calculate bounds, produce a manifest, and derive registry/UI lists from that manifest. Preserve stable provider/frame/asset IDs so semantic traces, saved selections, tests, and future migrations remain meaningful.
