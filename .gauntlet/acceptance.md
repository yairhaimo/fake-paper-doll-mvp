# Acceptance Matrix

| Gate | Required | Scenario or command | Threshold | Latest result | Status | Evidence |
|---|---:|---|---|---|---|---|
| Clean install and launch | Yes | Bootstrap install + `npm run build` | Exit 0 | Lockfile produced; production build clean | Pass | `package-lock.json`; Vite build output |
| Core loop smoke | Yes | Playwright S01 | Completes | Real move → jump → fall → land → attack pass | Pass | `tests/e2e/character-lab.spec.ts` |
| Runtime errors | Yes | Browser smoke + Playwright | Zero uncaught errors | 0 page/console/overlay errors | Pass | `scripts/browser-smoke.mjs` report |
| Composition coverage | Yes | Unit matrix | 4 loadouts × 6 clips | 168 resolved compositions; 26/26 unit tests | Pass | `tests/unit/` |
| Swap invariants | Yes | Unit + browser S02 | State unchanged except appearance | Run and attack-recovery swaps exact | Pass | Appearance/unit and E2E snapshots |
| Visual comparison | Yes | S03 gallery | Critic no blocker/high gap | `CANDIDATE_WINS`; no blocker/high defect | Pass | Final independent critic round |
| Performance p50 | Yes | S04, headless SwiftShader | < 24 ms | 19.1 ms | Pass | Final 141-sample browser run |
| Performance p95 | Yes | S04, headless SwiftShader | < 55 ms | 25.1 ms | Pass | Final 141-sample browser run |
| Stall ratio | Yes | S04, headless SwiftShader | < 6% over 50 ms | 0 / 141 | Pass | Final 141-sample browser run |
| Worst-frame limit | Yes | S04, headless SwiftShader | ≤ 100 ms; zero >100 ms | 28.0 ms; zero >100 ms | Pass | Final 141-sample browser run |
| Whole-slice integration | Yes | Fresh critic | No material coherence defect | Outfit/identity/facing/state evidence coherent | Pass | Final screenshots + critic verdict |
