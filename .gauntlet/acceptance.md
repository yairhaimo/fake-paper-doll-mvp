# Acceptance Matrix

| Gate | Required | Scenario or command | Threshold | Latest result | Status | Evidence |
|---|---:|---|---|---|---|---|
| Clean install and launch | Yes | Bootstrap install + `npm run build` | Exit 0 | Lockfile produced; production build clean | Pass | `package-lock.json`; Vite build output |
| Core loop smoke | Yes | Playwright S01 | Completes | Six hosted-Chrome scenarios pass | Pass | `tests/e2e/character-lab.spec.ts`; CI run 12 |
| Runtime errors | Yes | Browser smoke + Playwright | Zero uncaught errors | Fresh raster-era browser run is error-free | Pass | E2E boot gate; raster fallback unit tests |
| Composition coverage | Yes | Unit matrix | 4 loadouts × 6 clips | 168 semantic + presentation compositions; 33 unit tests | Pass | `tests/unit/` |
| Swap invariants | Yes | Unit + browser S02 | State unchanged except appearance | Run and attack-recovery swaps preserve exact state | Pass | Appearance unit tests; hosted-Chrome E2E |
| Visual comparison | Yes | S03 gallery | Critic no blocker/high gap vs concept sheet | Five raster-era baselines verified; matte spill, run coverage, and attack-card occlusion fixed | Pass | Visual baselines; quality and run-cycle boards |
| Performance p50 | Yes | S04, headless SwiftShader | < 24 ms | 18.3 ms across 142 samples | Pass | CI run 12 |
| Performance p95 | Yes | S04, headless SwiftShader | < 55 ms | 22.7 ms | Pass | CI run 12 |
| Stall ratio | Yes | S04, headless SwiftShader | < 6% over 50 ms | 0 / 142 frames over 50 ms | Pass | CI run 12 |
| Worst-frame limit | Yes | S04, headless SwiftShader | ≤ 100 ms; zero >100 ms | 25.8 ms worst; zero >100 ms | Pass | CI run 12 |
| Whole-slice integration | Yes | Fresh critic | No material coherence defect | Painterly loadouts, six-frame run, full attack silhouettes, debug layers, and swaps verified together | Pass | Fresh Chromium captures; CI run 12 |
