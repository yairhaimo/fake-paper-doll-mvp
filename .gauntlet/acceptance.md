# Acceptance Matrix

| Gate | Required | Scenario or command | Threshold | Latest result | Status | Evidence |
|---|---:|---|---|---|---|---|
| Clean install and launch | Yes | Bootstrap install + `npm run build` | Exit 0 | Lockfile produced; production build clean | Pass | `package-lock.json`; Vite build output |
| Core loop smoke | Yes | Playwright S01 | Completes | Raster-era remote browser run pending | Reopened | `tests/e2e/character-lab.spec.ts` |
| Runtime errors | Yes | Browser smoke + Playwright | Zero uncaught errors | Raster preload/fallback unit path passes; browser pending | Reopened | `tests/unit/raster-preload.test.ts` |
| Composition coverage | Yes | Unit matrix | 4 loadouts × 6 clips | 168 semantic + presentation compositions; 33 unit tests | Pass | `tests/unit/` |
| Swap invariants | Yes | Unit + browser S02 | State unchanged except appearance | Exact state-preservation unit coverage passes; browser pending | Reopened | Appearance/unit and E2E tests |
| Visual comparison | Yes | S03 gallery | Critic no blocker/high gap vs concept sheet | Matte spill and fake two-key run found and fixed; fresh runtime capture pending | Reopened | `docs/screenshots/character-quality-board.png`; `run-cycle-board.png` |
| Performance p50 | Yes | S04, headless SwiftShader | < 24 ms | Prior vector-era result is not accepted for raster release | Reopened | Fresh CI browser run required |
| Performance p95 | Yes | S04, headless SwiftShader | < 55 ms | Prior vector-era result is not accepted for raster release | Reopened | Fresh CI browser run required |
| Stall ratio | Yes | S04, headless SwiftShader | < 6% over 50 ms | Prior vector-era result is not accepted for raster release | Reopened | Fresh CI browser run required |
| Worst-frame limit | Yes | S04, headless SwiftShader | ≤ 100 ms; zero >100 ms | Prior vector-era result is not accepted for raster release | Reopened | Fresh CI browser run required |
| Whole-slice integration | Yes | Fresh critic | No material coherence defect | Painted poses integrated; clean-edge and six-frame run evidence produced; browser capture pending | Reopened | Fresh CI screenshots + critic required |
