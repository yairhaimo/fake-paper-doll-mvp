import { expect, test, type Page } from "@playwright/test";

async function waitForLab(page: Page): Promise<void> {
  await page.goto("/?testMode=1");
  await page.waitForFunction(() => window.__PAPER_DOLL__?.ready === true);
}

test("boots to a complete, error-free playable lab", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await waitForLab(page);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Character assembly" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Preview all combinations/i })).toBeVisible();

  const state = await page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot());
  expect(state.ready).toBe(true);
  expect(state.appearance).toMatchObject({
    identityId: "moss",
    outfitId: "trail",
    weaponId: "wooden-sword",
  });
  expect(state.composition.drawCount).toBeGreaterThan(15);
  expect(state.composition.hiddenLayers).toContain("body");
  expect(state.composition.replacedLayers).toEqual(
    expect.arrayContaining(["frontArm", "frontFoot", "frontHand"]),
  );
  expect(errors).toEqual([]);
});

test("movement, jump, fall, land, and attack complete through real input", async ({ page }) => {
  await waitForLab(page);
  await page.evaluate(() => window.__PAPER_DOLL__!.setPaused(false));
  const startX = await page.evaluate(
    () => window.__PAPER_DOLL__!.getSnapshot().simulation.position.x,
  );

  await page.keyboard.down("ArrowRight");
  await expect
    .poll(() =>
      page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().animation.animationId),
    )
    .toBe("run");
  await page.waitForTimeout(220);
  const running = await page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot());
  expect(running.simulation.position.x).toBeGreaterThan(startX);
  expect(running.simulation.velocity.x).toBeGreaterThan(0);
  await page.keyboard.up("ArrowRight");

  await page.keyboard.press("Space");
  await expect
    .poll(() =>
      page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().animation.animationId),
    )
    .toBe("jump");
  await expect
    .poll(() =>
      page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().animation.animationId),
    )
    .toBe("fall");
  await expect
    .poll(
      () =>
        page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().animation.animationId),
      { intervals: [16] },
    )
    .toBe("land");
  await expect
    .poll(() =>
      page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().simulation.grounded),
    )
    .toBe(true);

  await page.keyboard.press("j");
  await expect
    .poll(() =>
      page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().animation.animationId),
    )
    .toBe("attack");
  await expect
    .poll(() =>
      page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().animation.animationId),
    )
    .toBe("idle");
});

test("identity and outfit swaps preserve a frozen run exactly", async ({ page }) => {
  await waitForLab(page);
  await page.keyboard.down("ArrowRight");
  await page.evaluate(() => window.__PAPER_DOLL__!.setPaused(false));
  await page.waitForTimeout(280);
  await page.evaluate(() => window.__PAPER_DOLL__!.setPaused(true));
  await page.keyboard.up("ArrowRight");

  const before = await page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot());
  expect(before.animation.animationId).toBe("run");
  expect(before.simulation.velocity.x).toBeGreaterThan(0);

  const identitySwap = await page.evaluate(() =>
    window.__PAPER_DOLL__!.runSwapInvariant("identity"),
  );
  const outfitSwap = await page.evaluate(() =>
    window.__PAPER_DOLL__!.runSwapInvariant("outfit"),
  );
  expect(identitySwap.preserved).toBe(true);
  expect(outfitSwap.preserved).toBe(true);
  expect(identitySwap.before).toEqual(identitySwap.after);
  expect(outfitSwap.before).toEqual(outfitSwap.after);

  const after = await page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot());
  expect(after.simulation).toEqual(before.simulation);
  expect(after.animation).toEqual(before.animation);
  expect(after.appearance).toMatchObject({ identityId: "bramble", outfitId: "hoodie" });
});

test("gear swap preserves attack recovery progress and facing", async ({ page }) => {
  await waitForLab(page);
  await page.evaluate(() => {
    window.__PAPER_DOLL__!.setAnimation("attack", 25);
    window.__PAPER_DOLL__!.setPaused(true);
  });
  const before = await page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot());
  expect(before.animation.animationId).toBe("attack");
  expect(before.animation.frameIndex).toBeGreaterThanOrEqual(3);

  const result = await page.evaluate(() => window.__PAPER_DOLL__!.runSwapInvariant("weapon"));
  expect(result.preserved).toBe(true);
  expect(result.before).toEqual(result.after);

  const after = await page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot());
  expect(after.animation).toEqual(before.animation);
  expect(after.simulation.position).toEqual(before.simulation.position);
  expect(after.simulation.facing).toBe(before.simulation.facing);
  expect(after.appearance.weaponId).toBeNull();
});

test("gallery, layer stack, anchors, and frame stepping are operable", async ({ page }) => {
  await waitForLab(page);
  await page.getByRole("button", { name: /Preview all combinations/i }).click();
  await expect.poll(async () =>
    page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().debug.gallery),
  ).toBe(true);

  await page.evaluate(() => {
    window.__PAPER_DOLL__!.setGallery(false);
    window.__PAPER_DOLL__!.setLayerDebug(true);
    window.__PAPER_DOLL__!.setAnchorDebug(true);
  });
  await expect(page.locator("[data-layer-list] li")).toHaveCount(18);
  await expect(page.getByText(/0 missing palette tokens/i)).toBeVisible();

  const before = await page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().animation.frameIndex);
  await page.getByRole("button", { name: "Next frame" }).click();
  const after = await page.evaluate(() => window.__PAPER_DOLL__!.getSnapshot().animation.frameIndex);
  expect(after).not.toBe(before);
});

test("representative loop maintains the frame-time gate", async ({ page }) => {
  await waitForLab(page);
  await page.evaluate(() => {
    window.__PAPER_DOLL__!.setPaused(false);
  });
  // Warm every pose/context that appears in the measured scenario. Runtime
  // frame pacing must not include one-time SVG triangulation and shader setup.
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(900);
  await page.keyboard.press("j");
  await page.waitForTimeout(1_600);
  await page.keyboard.up("ArrowRight");
  await page.evaluate(() => window.__PAPER_DOLL__!.resetMetrics());

  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(1_400);
  await page.keyboard.press("j");
  await page.waitForTimeout(1_000);
  await page.keyboard.up("ArrowLeft");

  const metrics = await page.evaluate(() => window.__PAPER_DOLL__!.getMetrics());
  console.info("representative frame metrics", metrics);
  // This runner uses headless SwiftShader rather than a hardware GPU. These
  // thresholds catch regressions and stalls without pretending to certify a
  // target-device 60 fps result.
  expect(metrics.samples).toBeGreaterThan(70);
  expect(metrics.p50Ms).toBeLessThan(24);
  expect(metrics.p95Ms).toBeLessThan(55);
  expect(metrics.p99Ms).toBeLessThanOrEqual(100);
  expect(metrics.worstMs).toBeLessThanOrEqual(100);
  expect(metrics.hitchesOver50Ms / metrics.samples).toBeLessThan(0.06);
  expect(metrics.hitchesOver100Ms).toBe(0);
});
