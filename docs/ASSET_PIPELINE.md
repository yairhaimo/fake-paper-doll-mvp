# Asset pipeline

Softwood uses a controlled two-track asset pipeline:

- the semantic track is TypeScript-authored metadata and anchor-local vector geometry used for deterministic composition, validation, layer debugging, and failure fallback;
- the presentation track is authored painterly pose art processed into transparent raster atlases for normal gameplay.

This is a vertical-slice compromise. It proves the visual bar and the state-preserving compositor together without pretending that arbitrary future clothes can already combine from independently painted raster layers.

## Source and generated output

Controlled source sheets live in `art/source/character/v2/`. Runtime output lives in `public/assets/character/v2/`.

The source matrix contains:

- four armed general sheets: Moss/Bramble × Trail/Hoodie;
- four unarmed general sheets for the same combinations;
- four equipped attack sheets with six dedicated attack drawings;
- eight dedicated run sheets: armed and unarmed for every identity/outfit pair.

General sheets contain idle, jump-rise, fall, landing squash, and supporting action keys. Attack and run sheets contain six purpose-authored sequential drawings. Every source is a 3 × 2 sheet on a controlled chroma field.

The generation brief and prompts used to establish the source art are recorded in `art/source/character/v2/README.md`. `docs/concept-sheet.png` is the visual target, not a runtime dependency.

## Deterministic build

Run:

```bash
npm run assets:build
```

The build requires ImageMagick (`magick` or `convert`) and performs these steps for each sheet:

1. remove the chroma field with controlled color/fuzz passes;
2. downsample the authored sheet with Lanczos filtering;
3. identify the six large connected foreground components;
4. isolate each pose rather than trusting guide-cell edges;
5. repack each pose into a non-overlapping 512 × 512 cell on a transparent 1536 × 1024 atlas;
6. register each pose to its authored ground line;
7. remove detached chroma flecks after the real pose components are isolated;
8. decontaminate transparent/edge RGB so texture filtering cannot recreate a magenta matte;
9. strip nondeterministic metadata.

Component isolation matters because strong run, landing, and sword silhouettes intentionally cross the original guide-cell boundaries. Hard cropping source cells would either cut the character or include a neighboring pose.

Verify committed output without overwriting it:

```bash
npm run assets:check
```

The check rebuilds every sheet into a temporary directory and compares SHA-256 bytes. Missing, stale, corrupt, or differently processed output fails the command.

## Runtime selection

`authoredPoseBundles.ts` maps an `AppearanceSelection`, animation ID, and frame index to a `RasterPieceDescriptor`:

- armed/unarmed run uses the matching dedicated six-cell run sheet;
- equipped attack uses the matching six-cell attack sheet;
- other armed/unarmed animations use the corresponding general sheet;
- idle keeps four deterministic frame IDs and adds a restrained bottom-pinned breathing scale;
- jump, fall, and land use matching authored cells;
- unarmed attack uses an explicit six-frame mapping from unequipped action poses.

All 168 supported selections are enumerated at module initialization: two identities × two outfits × sword on/off × 21 frame IDs. Every descriptor uses a fixed pixel crop and bottom-rooted destination bounds. Facing remains a root-centered horizontal mirror in the renderer.

`GameLab` preloads presentation pieces before the first playable frame. `VectorCharacterView` caches source textures and subtextures, then reuses persistent Pixi `Sprite`/`Graphics` slots. A failed preload is recorded rather than aborting startup; the complete semantic vector command stack renders as fallback. Layer-debug mode deliberately uses that semantic stack even when a painting is ready.

## Semantic authoring contract

The presentation layer does not alter the canonical body:

- logical canvas: 256 × 256;
- root: `(128, 232)`;
- ground: `y = 232`;
- six animations and 21 stable frame IDs;
- named anchors and explicit per-frame layer order;
- one canonical anatomy shared by both identities and outfits.

The resolver still applies providers in identity → outfit → weapon order. Equipment declares `supportedLayers`, `hideLayers`, and `replaceLayers`; implicit collisions fail. The result retains every semantic draw command, provider trace, hidden/replaced layer record, palette, anchor, and signature even when normal mode displays a selected full-pose painting.

## Add an identity

1. Add the semantic identity definition, palette, and complete frame coverage in `registries.ts` / `vectorAssets.ts`.
2. Preserve the canonical root, anatomy, frame count, and outfit fit.
3. Author armed and unarmed general and run sheets for each supported outfit.
4. Author one equipped attack sheet per supported outfit.
5. Add filenames and measured registration to `scripts/build-character-assets.mjs`.
6. Extend the typed matrix in `authoredPoseBundles.ts` and the UI/gallery choices.
7. Rebuild assets, run exhaustive validation, and review at actual game/gallery scale.

Identity differences may change fur color, face/eyes, ears or horns, tufts, and minor silhouette details. They must not change the clothing-compatible body contract.

## Add an outfit

1. Add an `EquipmentDefinition` with explicit supported, hidden, and replaced semantic layers.
2. Supply complete semantic frame maps and anchor-local fallback geometry.
3. Paint armed and unarmed general/run sheets for each supported identity.
4. Paint one equipped attack sheet per identity.
5. Add files to the build and extend presentation/UI/gallery matrices.
6. Inspect shoulders, cuffs, waist, hands, footwear, hood/ear/horn underlaps, sword grip, and both facings.

The outfit must visibly follow each pose. Do not create one rigid torso image and rotate sleeve rectangles around it.

## Add a held item

The current held-item slot is `weapon` and supports `null` or `wooden-sword`.

1. Add a weapon definition with explicit front-hand replacement and weapon back/front layers.
2. Provide complete semantic coverage and grip anchors.
3. Add equipped presentation sheets for every supported identity/outfit combination.
4. Author dedicated run/attack drawings when the item changes silhouette or hand ownership.
5. Expand the selector and presentation key rather than treating a second weapon as a boolean sword skin.

## Validation and review

| Check | Enforced by |
| --- | --- |
| Source/output reproducibility | `npm run assets:check` |
| Exactly six major isolated poses per sheet | asset build connected-component check |
| Raster source, crop, normalized anchor, and bounds validity | `validateAssets()` and unit tests |
| Complete semantic provider/frame coverage | `validateCharacterSystem()` |
| All 168 presentation selections | `authored-pose-bundles.test.ts` |
| Atomic identity/outfit/weapon swaps | appearance, unit, and browser invariant tests |
| Raster-load failure fallback | renderer tests and semantic command retention |
| Material, silhouette, clothing fit, and weapon read | native-scale human/critic review |

Run the non-browser checks with:

```bash
npm run assets:check
npm test
npm run build
```

Playwright interaction and visual suites additionally require an installed Chromium binary.

## Known limitation and next step

The current polished sheets are loadout-level presentation bundles. They demonstrate two identities, two outfits, weapon on/off, all required animations, live swapping, and deterministic timing at a serious visual bar. They are not yet a scalable wardrobe atlas because a new outfit requires new full-pose paintings for each identity.

The next production step is to split each accepted painting into pose-specific semantic raster underlaps—rear/front limbs, hands, feet, torso clothing, head/face, back/front fur or hair, and weapon—then export a versioned atlas/metadata manifest. The existing resolver, explicit hide/replace rules, anchors, sprite pool, vector fallback, and tests are designed to remain in place during that migration.
