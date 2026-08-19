# Gauntlet Charter

## Goal

- Player-facing outcome: A small, charming sidescroller lab where a fuzzy monster can move, jump, land, attack, and change identity, clothing, and held item without breaking motion or animation continuity.
- Player promise in one sentence: Every appearance combination feels deliberately drawn while every live swap is technically seamless.
- Current problem: Prove a scalable hybrid paper-doll contract without cardboard rotation, broken seams, or state resets.
- Target milestone: One production-minded browser vertical slice.

## Target environment

- Engine and version: PixiJS 8 with strict TypeScript and Vite.
- Platforms: Modern desktop and mobile browsers.
- Input methods: Keyboard, pointer, and touch controls.
- Target viewport or resolution: 1440 × 900 reference capture, responsive down to 390 × 844.
- Target hardware: Typical integrated-GPU laptop and current mobile browser.
- Quality settings: DPR capped at 2; deterministic visual-test mode uses DPR 1.

## Constraints

- Must preserve: World position, velocity, facing, grounded state, animation clip, frame, and normalized progress during appearance swaps.
- Explicit non-goals: Full combat, inventory, networking, multiple body archetypes, eight-direction movement, procedural cloth, progression, audio production.
- Architecture constraints: One canonical body; authored pose geometry; semantic layers; fixed-tick animation; pure composition resolution; no rotating rectangular anatomy.
- Asset constraints: Original code-native vector pieces and a generated concept reference; no copied game assets or visual imitation.
- User-defined resource limit: Smallest convincing vertical slice.

## Quality bars

| Dimension | Concrete reference or measurement | Comparison scenario | Pass condition |
|---|---|---|---|
| Core loop | Move, jump, land, attack, and swap appearance | S01 keyboard smoke | All actions complete without repair |
| Game feel | Immediate input and clear anticipation/contact/recovery | S02 run-jump-attack | No stuck input; transitions readable |
| Visual coherence | Shared mascot family with pose-authored clothing | S03 2 × 2 gallery | Four combinations read as one family; no visible seams |
| UI and onboarding | Controls discoverable in the first viewport | S01 fresh load | Keyboard and touch controls visible and usable |
| Performance | Fixed-step simulation with a 60 fps hardware target | S04 warmed motion loop | Headless SwiftShader: p50 < 24 ms, p95 < 55 ms, < 6% frames over 50 ms, zero frames over 100 ms; hardware profile remains a handoff gate |
| Stability | No page errors, missing pieces, unresolved anchors, or NaN transforms | All scenarios | Zero uncaught errors and zero validation diagnostics |

## Repeatable scenarios

| ID | Setup and seed | Input sequence | Evidence captured | Purpose |
|---|---|---|---|---|
| S01 | `/` fresh load, fixed seed 1337 | Right, jump, attack, identity/outfit/weapon swaps | Screenshot + state assertions + console | Complete interaction smoke |
| S02 | `/?test=run-swap` | Hold right, swap identity and outfit mid-run, attack | Before/after state snapshots | Swap invariants and game feel |
| S03 | `/?gallery=1&animation=idle&tick=18` | No live input; fixed clock | 1440 × 900 screenshot | Combination coherence |
| S04 | `/?profile=1` | Scripted run/jump/attack loop for 20 seconds | Frame-time JSON | Representative performance |

## Acceptance gates

- [x] Clean install and launch recipe succeeds.
- [x] Core interaction smoke completes without manual repair.
- [x] No uncaught runtime or renderer errors.
- [x] All 2 × 2 identity/outfit combinations render with the sword.
- [x] Idle, run, jump, fall, land, and attack are visually distinct.
- [x] Swap-during-run and swap-during-attack invariants pass.
- [x] Deterministic screenshots and command hashes are stable.
- [x] Independent whole-slice critic reports no blocker or high-severity gap.

## Coupling map

| Concern | Coupled with | Ownership mode | Reason |
|---|---|---|---|
| Simulation and animation | State-preserving swaps | Sequential | Same fixed-tick state contract |
| Vector pieces and composition | Layering and anchors | Sequential | Shared visual contract and draw order |
| UI controls | Appearance store and input | Sequential | Controls mutate live state |
| Unit tests and docs | Pure schema contract | Parallel | Stable public interfaces |
| Visual criticism | Running candidate only | Independent | Builder must not grade itself |

## Stop policy

Continue while a mandatory gate fails or a critic identifies a material gap with a credible next improvement. Stop when all gates pass and remaining gains are smaller than their regression risk.
