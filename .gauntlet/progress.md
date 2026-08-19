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
