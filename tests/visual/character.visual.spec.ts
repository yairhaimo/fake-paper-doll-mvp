import { expect, test, type Locator, type Page } from "@playwright/test";

// Raster readback through headless SwiftShader is deliberately slower than a
// hardware-backed browser. Keep the visual gate strict without letting the
// runner kill a capture while it is still producing mismatch evidence.
test.setTimeout(360_000);

async function openFixed(page: Page, query: string): Promise<void> {
  await page.goto(`/?testMode=1&paused=1&${query}`);
  await page.waitForFunction(() => window.__PAPER_DOLL__?.ready === true);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}

async function expectStableImage(locator: Locator, name: string): Promise<void> {
  // Prime the WebGL readback once. Headless SwiftShader can expose a frame
  // before Pixi's text textures have reached the canvas on the first capture.
  await locator.screenshot({ animations: "disabled" });
  await locator.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  const image = await locator.screenshot({ animations: "disabled" });
  expect(image).toMatchSnapshot(name, {
    maxDiffPixelRatio: 0.008,
    threshold: 0.2,
  });
}

for (const scenario of [
  { name: "idle", tick: 18 },
  { name: "run", tick: 17 },
  { name: "attack", tick: 13 },
] as const) {
  test(`four loadouts remain coherent in ${scenario.name}`, async ({ page }) => {
    await openFixed(page, `gallery=1&animation=${scenario.name}&tick=${scenario.tick}`);
    await expectStableImage(page.locator(".canvas-wrap"), `gallery-${scenario.name}.png`);
  });
}

test("anchor and semantic-layer overlay remains aligned", async ({ page }) => {
  await openFixed(page, "animation=attack&tick=13&debug=layers,anchors");
  await expectStableImage(page.locator(".canvas-wrap"), "debug-attack-strike.png");
});

test("both facing directions share the same grounded root", async ({ page }) => {
  await openFixed(page, "animation=run&tick=17");
  const right = await page.locator(".canvas-wrap").screenshot();
  await page.evaluate(() => {
    window.__PAPER_DOLL__!.setFacing(-1);
    window.__PAPER_DOLL__!.setAnimation("run", 17);
  });
  const state = await page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot());
  expect(state.simulation.facing).toBe(-1);
  expect(state.simulation.position.y).toBe(444);
  expect(state.animation.frameIndex).toBe(3);
  expect(right.length).toBeGreaterThan(10_000);
  await expectStableImage(page.locator(".canvas-wrap"), "run-facing-left.png");
});
