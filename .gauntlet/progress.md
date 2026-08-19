# Gauntlet Progress

## Baseline

- Timestamp: 2026-08-19
- Workstream: New vertical slice
- Baseline evidence: Empty repository; no executable artifact.
- Candidate evidence: Pending.
- Largest confirmed gap: No playable character system exists yet.
- Next action: Establish the deterministic engine, authored vector asset contract, playable lab, and capture harness.

## Round 1 — integrated slice

- Candidate evidence: `tests/visual/character.visual.spec.ts-snapshots/gallery-{idle,run,attack}-linux.png`, `debug-attack-strike-linux.png`, and `run-facing-left-linux.png`.
- Verification: 22 unit tests, production build, five browser scenarios, and five visual scenarios passed.
- Independent verdict: `BAR_WINS`.
- Largest confirmed gap: Attack contact relied too heavily on the weapon arm; body weight, counterpose, expression, and grip inspection were weak.
- Action: Re-authored `attack_3` as a whole-body contact pose and separated anchor callouts.

## Round 2 — gold contact

- Candidate evidence: Updated attack gallery and anchor overlay at attack tick 13.
- Verification: 24 unit tests and targeted attack/debug visual scenarios passed.
- Independent verdict: `BAR_WINS`.
- Improvements confirmed: Four-loadout clothing fit, identity/outfit readability, and a visibly authored attack contact remained coherent.
- Largest confirmed gap: The left-facing run evidence advanced into a planted recovery key and did not read as running at thumbnail scale.
- Action: Pin both facings to `run_3`, re-author that frame as a single-support silhouette, and strengthen the thumbnail-scale attack lean.

## Round 3 — silhouette and parity

- Candidate evidence: Final five baselines in `tests/visual/character.visual.spec.ts-snapshots/` plus `docs/screenshots/paper-doll-lab.png`.
- Improvements: `run_3` has one planted support foot, 27 px rear-foot lift, 11 px body lead, opposed arms, and a behind-body carried sword. `attack_3` has an 18 px neck/waist lead and stronger counterpose. Facing parity uses a deterministic harness setter rather than variable movement time.
- Verification: 26/26 unit tests; production build; 6/6 end-to-end scenarios; all five current visual scenarios passed across the final baseline/update and replay runs; browser smoke returned HTTP 200 with no errors.
- Performance evidence: 141 samples, p50 19.1 ms, p95 25.1 ms, worst 28.0 ms, zero >50 ms hitches in the final warmed SwiftShader run.
- Independent verdict: `CANDIDATE_WINS`.
- Final critic gate: No blocker or high-severity defect remains; no visible state or facing regression.
- Stop decision: All mandatory acceptance gates pass. Remaining gains (stronger attack arc and more silhouette fur breaks) are scoped follow-up polish rather than vertical-slice blockers.

## Round 4 — user rejection and art-direction reset

- User evidence: `upload/0242d73b-0b98-40fb-84ec-c522502c0858.png` was rejected as not looking like a playable game character and not matching `docs/concept-sheet.png`.
- Honest re-baseline: The deterministic compositor, swaps, tests, and tooling remain reusable. The solid-fill code-vector presentation is not capable of reaching the required furry, painterly material bar without becoming an illustration system.
- Independent audits: Both visual and renderer audits recommend preserving simulation/composition while moving final presentation to authored raster poses with a persistent Pixi sprite backend and vector fallback for semantic debugging.
- Gold-pose result: Moss + Trail idle, run contact, jump, fall, land, and attack contact now use visibly furry contours, three-value painted volume, fitted cloth, detailed leather footwear, expressive eyes, and a faceted wooden sword.
- Production content: Equipped and unequipped 3 × 2 sheets exist for all four identity/outfit combinations; a dedicated six-drawing equipped attack sequence exists for all four combinations.
- Largest remaining gap: Integrate the authored sheets into the live resolver/view, capture native-scale evidence, and run fresh blind critic and regression loops.
- Stop decision: Reopened. The earlier `CANDIDATE_WINS` verdict is superseded by direct user rejection and cannot be used as acceptance evidence.

## Round 5 — authored raster rebuild and strict re-audit

- Normal play now selects painterly authored pose bundles while the deterministic semantic stack remains available for layer debug and fallback.
- First independent review rejected the raster candidate for a one-pixel magenta matte and a two-key run mapping that reused the jump pose.
- The build now neutralizes hidden/edge chroma RGB without trimming alpha. Objective dark-background audit reduced detected Moss fringe pixels from 16,075 to 0 and Bramble from 25,821 to 2.
- Eight dedicated armed/unarmed six-drawing run sheets replace the contact/jump alternation for all four identity/outfit combinations.
- Startup preload failure no longer aborts the app; semantic fallback, lazy gallery invalidation, and visible raster diagnostics have focused unit coverage.
- Current evidence: `docs/screenshots/character-quality-board.png` and `docs/screenshots/run-cycle-board.png`, both composed directly from committed runtime atlas cells on a dark background.
- Stop decision: Superseded by the final native-scale browser gate below.

## Round 6 — native-scale release gate

- Fresh hosted-Chrome captures verify all four loadouts in idle and run, the full attack contact, semantic layer/anchor debug, and grounded left-facing parity.
- The first attack gallery capture exposed sword tips being covered by later card backgrounds. The gallery now biases wide attack previews left so every authored weapon silhouette remains visible inside its own card.
- Verification: 20-sheet deterministic asset check; 33/33 unit tests; production build; 6/6 real-input browser scenarios; five raster-era visual baselines.
- Performance: 142 warmed samples, p50 18.3 ms, p95 22.7 ms, p99 24.7 ms, worst 25.8 ms, and zero frames over 33/50/100 ms on hosted headless Chrome.
- Final visual verdict: The shipped character is visibly furry, dimensional, fitted, expressive, and game-readable at native scale. The earlier flat vector presentation survives only as the explicit semantic debug/fallback path.
- Stop decision: All mandatory vertical-slice gates pass. Remaining work is content expansion, not repair of this foundation.
