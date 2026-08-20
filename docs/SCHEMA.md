# Character schema

The runtime schema is structured, readonly TypeScript metadata rather than a JSON file. `src/character/types.ts` defines the public shapes; `canonicalBody.ts`, `registries.ts`, and `vectorAssets.ts` construct largely frozen definitions behind `ReadonlyMap` APIs. The catalog’s underlying maps are ordinary `Map` instances, so consumers should treat the catalog as read-only rather than assume deep runtime immutability. This document describes the serialized shape those types imply without claiming that runtime JSON loading exists.

## Top-level model

| Type | Purpose |
| --- | --- |
| `CanonicalBodyContract` | Logical canvas, tick rate, root/ground, bounds envelopes, required anchors, layer order, and animations. |
| `AnimationDefinition` / `FrameDefinition` | Loop policy plus stable frame ID, integer duration, anchors, pose tags, draw order, and optional frame hides. |
| `VectorPieceDescriptor` | One anchor-local vector asset with semantic layer, bounds, fallback primitives, and tags. |
| `RasterPieceDescriptor` | A source image/crop mapped into destination bounds, with optional normalized source anchor and required vector fallback field. |
| `PieceDescriptor` | Discriminated union of vector and raster descriptors. |
| `IdentityDefinition` | Base provider palette, supported layers, full animation coverage, and frame-indexed piece maps. |
| `EquipmentDefinition` | Outfit or weapon provider plus explicit hide/replace rules. |
| `CharacterCatalog` | Readonly maps for assets, identities, outfits, and weapons. |
| `AppearanceSelection` | `identityId`, `outfitId`, and nullable `weaponId`; snapshots add `revision`. |
| `CompositionResult` | Appearance, palette, ordered semantic draw commands, hidden/replaced layers, trace/signature, and optional authored presentation piece for one frame/facing. |
| `ValidationReport` | Valid flag, structured issues, and exhaustive composition count. |

## Stable enumerations

Animation IDs, in declared order:

```text
idle, run, jump, fall, land, attack
```

Required anchors:

```text
root, ground, neck, headTop, faceCenter,
shoulderRear, elbowRear, handRear,
shoulderFront, elbowFront, handFront,
waist, hipRear, kneeRear, footRear,
hipFront, kneeFront, footFront,
tailRoot, weaponGrip
```

Default semantic layer order, from back to front:

```text
groundShadow, tailBack, weaponBack, earBack, tuftBack,
rearFoot, rearLeg, rearArm, rearHand, body, topBack, head, face,
bottoms, frontLeg, frontFoot, top, frontArm, frontHand, tuftFront,
hoodOrHatFront, weaponFront, accessoryFront
```

`FrameDefinition.layerOrder` may override the default. The current `attack_2` and `attack_4` frames append `weaponFront` after `accessoryFront`; `attack_3` inserts `weaponFront` immediately before `frontHand` so the hand covers the grip.

Pose channels are `body`, `head`, `face`, `tail`, `tuft`, `rearArm`, `rearHand`, `frontArm`, `frontHand`, `rearLeg`, `frontLeg`, `rearFoot`, `frontFoot`, and `weapon`.

## Canonical body and animations

The current contract has `version: 1`, `logicalWidth: 256`, `logicalHeight: 256`, `tickRate: 60`, `rootOrigin: { x: 128, y: 232 }`, and `groundY: 232`. Every frame repeats that root and ground and supplies every required anchor.

| Animation | Loop | Frame IDs | Durations in ticks | Total |
| --- | ---: | --- | --- | ---: |
| `idle` | yes | `idle_0` … `idle_3` | 11, 10, 11, 12 | 44 |
| `run` | yes | `run_0` … `run_5` | 5, 5, 5, 5, 5, 5 | 30 |
| `jump` | no | `jump_0`, `jump_1` | 6, 6 | 12 |
| `fall` | yes | `fall_0` | 1 | 1 |
| `land` | no | `land_0`, `land_1` | 4, 7 | 11 |
| `attack` | no | `attack_0` … `attack_5` | 5, 4, 3, 4, 6, 7 | 29 |

Frame array position is used to retrieve coverage, but `FrameDefinition.id` is also validated against `<animationId>_<frameIndex>` so it is never silently inferred.

## Provider metadata

Provider piece data is an `AnimationPieceTable`: every animation ID maps to an array with exactly one `LayerPieceMap` per canonical frame. A layer map contains asset IDs, not geometry. Geometry is resolved through `CharacterCatalog.assets`.

Current provider rules are:

| Provider | Supported layers | Hide | Replace |
| --- | --- | --- | --- |
| identity `moss`, `bramble` | `groundShadow`, `tailBack`, `earBack`, `tuftBack`, `rearFoot`, `rearLeg`, `rearArm`, `rearHand`, `body`, `head`, `face`, `frontLeg`, `frontFoot`, `frontArm`, `frontHand`, `tuftFront` | n/a | n/a |
| outfit `trail` | `rearFoot`, `rearArm`, `bottoms`, `frontFoot`, `top`, `frontArm` | `body` | `rearArm`, `frontArm`, `rearFoot`, `frontFoot` |
| outfit `hoodie` | `rearFoot`, `rearArm`, `topBack`, `bottoms`, `frontFoot`, `top`, `frontArm`, `hoodOrHatFront` | `body` | `rearArm`, `frontArm`, `rearFoot`, `frontFoot` |
| weapon `wooden-sword` | `frontHand`, `weaponBack`, `weaponFront` | none | `frontHand` |

Identity, outfit, and weapon all declare coverage for all six animations. Palette tokens are namespaced as `identity.*`, `outfit.*`, `weapon.*`, or `shared.*`; the resolver overlays palettes in provider order.

### Representative JSON-shaped projection

The following is an intentionally abridged projection of real `moss` / `idle_0` metadata. It shows the relationships without duplicating all anchors, palette tokens, primitives, or animation arrays:

```json
{
  "appearance": {
    "identityId": "moss",
    "outfitId": "trail",
    "weaponId": "wooden-sword"
  },
  "frame": {
    "id": "idle_0",
    "durationTicks": 11,
    "rootOrigin": { "x": 128, "y": 232 },
    "groundY": 232,
    "anchors": {
      "root": { "x": 128, "y": 232 },
      "shoulderFront": { "x": 154, "y": 135 }
    },
    "poses": { "frontArm": "idle-settle" }
  },
  "identityFramePieces": {
    "providerId": "moss",
    "animationId": "idle",
    "frameIndex": 0,
    "layers": {
      "groundShadow": "shared/ground-shadow",
      "frontArm": "identity/moss/idle_0/frontArm"
    }
  },
  "asset": {
    "id": "identity/moss/idle_0/frontArm",
    "shapeKey": "identity.moss.frontArm.idle_0.idle-settle",
    "layer": "frontArm",
    "attachmentAnchor": "shoulderFront",
    "bounds": { "x": -28, "y": -30, "width": 90, "height": 105 },
    "tags": ["authored-bent-limb", "pose-specific", "idle-settle"]
  }
}
```

The actual `FrameDefinition.anchors` and `poses` are complete records. Semantic catalog assets have vector primitives. Authored full-pose presentation descriptors are raster assets outside the semantic provider maps and may use an empty primitive list because the renderer falls back to the composition's complete semantic command stack.

## Raster presentation descriptors

A raster descriptor adds `kind: "raster"`, a public `source` URL, optional pixel `sourceRect`, optional normalized `sourceAnchor`, and destination `bounds`. The current presentation adapter uses fixed 512 × 512 source cells, attaches them to `root`, and bottom-centers the destination bounds on that anchor. `authoredPoseBundles.ts` enumerates 168 deterministic descriptors: two identities × two outfits × sword on/off × 21 frames.

The presentation descriptor is additive metadata. It does not replace `drawCommands`, `trace`, `hiddenLayers`, `replacedLayers`, or the semantic signature. Custom catalog combinations with no presentation mapping intentionally keep rendering through semantic pieces.

## Hide, replace, and draw semantics

The resolver maintains one selected piece per semantic layer. Providers apply in identity → outfit → weapon order.

- `hideLayers` deletes an earlier provider’s piece and records the layer only if a piece was removed.
- `replaceLayers` grants permission; a layer is recorded as replaced only when the provider supplies a piece and overwrites an existing selection.
- Supplying an occupied layer without permission is an error.
- A frame’s optional `hiddenLayers` applies after providers. Current canonical frames do not use it.
- `layerOrder` determines output order. A selected layer omitted from it is an error.

Every `DrawCommand` contains a zero-based ordinal, layer, asset/provider IDs, shape key, attachment anchor and coordinates, offset, and asset descriptor. Facing does not select different assets; it is `1` or `-1` and is applied by the view.

## Semantic trace and signature

A trace row has this stable form:

```text
<zero-padded ordinal>:<layer>:<providerKind>/<providerId>:<assetId>@<anchorName>(<x>,<y>)
```

The resolver joins animation ID, frame index/ID, facing, canonically ordered hidden/replaced layers, and trace rows, then computes unsigned 32-bit FNV-1a and emits eight lowercase hexadecimal characters. The same request and unchanged catalog therefore yield the same trace, draw-command serialization, and signature.

The signature is intentionally semantic. It is not a pixel hash and does not separately digest primitive path bytes or palette values; visual snapshots cover raster output.

## Validation matrix

`validateCharacterSystem()` reports structured `ValidationIssue` objects with `severity`, `code`, `message`, and optional context. The current default report is valid with no issues and `checkedCompositions: 168`.

| Scope | Representative failures |
| --- | --- |
| Body contract | `INVALID_LOGICAL_CANVAS`, `INVALID_TICK_RATE`, `UNSTABLE_FRAME_ID`, `INVALID_FRAME_DURATION`, `ROOT_CONTRACT_BROKEN`, `INVALID_ANCHOR`, duplicate/unknown draw layers |
| Provider tables | Missing animation coverage, frame-count mismatch, undeclared or duplicate supported layers |
| Assets | Registry key mismatch, missing/empty asset, invalid bounds, layer mismatch, missing attachment anchor |
| Raster assets | Empty source URL, invalid crop, invalid normalized source anchor, non-finite destination bounds |
| Pose geometry | `NON_POSE_SPECIFIC_SHAPE` for required arm/foot contours |
| Equipment rules | Conflicting or duplicate hide/replace declarations |
| Composition | Unknown IDs, unsupported animation, missing frame/asset/anchor, implicit collision, or layer absent from draw order |

`AppearanceStore` performs an additional full-frame composition check for a candidate selection before its single commit. Static validation checks the whole catalog, while unit, end-to-end, and visual suites verify timing, swap invariants, browser wiring, performance regressions, and final appearance.

## Schema evolution

Although the body contract exposes `version: 1`, no loader, migration table, or persisted save format exists yet. A future external schema should preserve stable animation/frame/provider/asset IDs, encode version compatibility explicitly, validate palette token ownership, and decide whether semantic signatures must include geometry and palette digests. Generated TypeScript types can remain the runtime boundary while a build-time importer owns parsing and migration.
