# Softwood Paper Doll Lab

Softwood is a small, playable proof of concept for a deterministic paper-doll character system. A fixed 60 Hz simulation drives authored animation frames; identity, outfit, and held-item choices are resolved into semantic vector pieces without resetting movement or animation time. PixiJS renders those pieces through a persistent character view.

![Softwood Paper Doll Lab](docs/screenshots/paper-doll-lab.png)

The MVP includes:

- identities `moss` (Moss) and `bramble` (Bramble);
- outfits `trail` (Trail Set) and `hoodie` (Cloud Hoodie; labelled “Scout hoodie” in the inspector);
- the optional `wooden-sword` (Wooden Practice Sword);
- `idle`, `run`, `jump`, `fall`, `land`, and `attack` animations, comprising 21 authored frames;
- eight selectable loadouts. The compatibility gallery displays the four identity/outfit combinations with the sword equipped;
- layer, anchor, timeline, frame-step, and frame-time diagnostics.

Appearance swaps are transactions: a candidate is resolved across every authored frame before it is committed. Simulation position, velocity, facing, tick, and animation progress remain untouched.

## Run locally

```bash
npm install
npm run dev
```

Vite serves the lab at <http://localhost:4173>. A production build can be checked with:

```bash
npm run build
npm run preview
```

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 4173. |
| `npm run build` | Type-check with `tsc -b`, then create the Vite production bundle. |
| `npm run preview` | Serve the production build on port 4173. |
| `npm test` | Run the Vitest unit suites once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:e2e` | Run the Playwright interaction and frame-time suites. |
| `npm run test:visual` | Compare the five Playwright visual scenarios with their baselines. |
| `npm run test:visual:update` | Deliberately replace the visual baselines. Review the resulting images. |
| `npm run verify:browser` | Smoke-test an already running server and write a browser capture. |
| `npm run check` | Run unit tests, build, end-to-end tests, and visual tests in sequence. |

Install Playwright’s browser once if it is not already available:

```bash
npx playwright install chromium
```

Playwright and the browser smoke script use Playwright-managed Chromium by default. To use a particular local binary instead, set `CHROMIUM_EXECUTABLE_PATH` for the command:

```bash
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium npm run test:e2e
```

`npm run verify:browser` defaults to `http://127.0.0.1:4173` and `.gauntlet/captures/current/browser-smoke.png`; an alternate URL and output path may be passed after `--`.

## Controls

| Action | Keyboard | UI |
| --- | --- | --- |
| Move | `A` / `D` or left / right arrows | Left / right touch buttons |
| Jump | `W`, up arrow, or `Space` | Jump button |
| Attack | `J` or `K` | Attack button |
| Cycle identity | `Q` | Moss / Bramble selector |
| Cycle outfit | `E` | Trail set / Scout hoodie selector |
| Toggle sword | `R` | Practice sword toggle |
| Toggle gallery | `G` | Preview all combinations button |

Attacks start only while grounded. The inspector can also force any animation, pause the clock, and step to the previous or next authored frame. Frame stepping pauses playback automatically.

### Debug modes

- **Layer stack** tints resolved pieces by semantic layer and lists their final draw order.
- **Anchors** shows selected body, limb, item, root, and ground sockets.
- **Compatibility gallery** renders the four sword-equipped identity/outfit combinations at the same animation frame.
- **Telemetry** shows animation progress, position, velocity, and missing palette tokens in the UI; `window.__PAPER_DOLL__` additionally exposes snapshots and frame-time percentiles to tests.

Reproducible states can be opened with query parameters:

```text
/?paused=1&animation=attack&tick=13&debug=layers,anchors
```

Supported parameters are `animation=<id>`, positive integer `tick=<n>`, `gallery=1`, `paused=1`, `testMode=1` (a pause alias used by tests), and comma-separated `debug=layers,anchors`.

## Design and authoring

- [Architecture](docs/ARCHITECTURE.md) — state ownership, resolution order, coordinate spaces, persistence, and determinism.
- [Asset pipeline](docs/ASSET_PIPELINE.md) — how the current TypeScript-authored vectors become rendered pieces, and how to add content.
- [Schema](docs/SCHEMA.md) — canonical IDs, anchors, layers, metadata, animation coverage, and validation rules.

## Verification matrix

| Layer | What it guards |
| --- | --- |
| Unit | Integer animation timing, semantic composition, stable signatures, atomic swaps, schema validation, and pose-specific geometry metadata. |
| End to end | Error-free boot, swap preservation during run/attack, debug controls, gallery/frame stepping, and a headless frame-time regression gate. |
| Visual | Gallery poses for `idle`, `run`, and `attack`; attack layer/anchor alignment; and left-facing grounded-root behavior. |
| Browser smoke | Canvas/content/error checks plus a serialized harness snapshot and screenshot. |

The default validator exhaustively resolves 168 combinations: 2 identities × 2 outfits × sword on/off × 21 frames.

## Known limits and next steps

This is deliberately a vertical slice. Vector geometry, palettes, registry membership, UI choices, and gallery entries are compiled into TypeScript; there is no external asset loader or editor export step. Frames are discrete rather than interpolated, only one outfit and one optional weapon slot exist, and the semantic signature is not a raster or full geometry digest. The headless performance test is a regression gate under SwiftShader, not target-device certification.

The most useful next steps are to generate versioned metadata from an authoring source, derive UI choices from registries, add a validation CLI and migration rules, broaden equipment slots and visual coverage, and profile the persistent renderer on target hardware.
