import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const url = process.argv[2] ?? "http://127.0.0.1:4173";
const screenshotPath = resolve(
  process.argv[3] ?? ".gauntlet/captures/current/browser-smoke.png",
);
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;

await mkdir(dirname(screenshotPath), { recursive: true });

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-frame-rate-limit",
    "--disable-gpu-vsync",
  ],
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});

let report;
try {
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForFunction(() => window.__PAPER_DOLL__?.ready === true, undefined, {
    timeout: 20_000,
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  report = await page.evaluate(() => {
    const overlay = document.querySelector(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    );
    const buttons = [...document.querySelectorAll("button")].map((button) =>
      button.textContent?.trim().replace(/\s+/g, " "),
    );
    return {
      hasContent: document.body.innerText.trim().length > 0,
      hasCanvas: document.querySelector("canvas") !== null,
      hasErrorOverlay: overlay !== null,
      buttonCount: buttons.length,
      buttons: buttons.slice(0, 12),
      state: window.__PAPER_DOLL__?.getSnapshot(),
    };
  });

  const passed =
    response?.ok() === true &&
    report.hasContent &&
    report.hasCanvas &&
    !report.hasErrorOverlay &&
    errors.length === 0;
  console.log(
    JSON.stringify(
      {
        passed,
        status: response?.status(),
        url,
        screenshotPath,
        errors,
        ...report,
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
} finally {
  await browser.close();
}
