import { devices, test } from "@playwright/test";
import { join } from "node:path";

const docs = (file: string) => join(import.meta.dirname, "..", "docs", file);
// Moments of the demo script, in milliseconds from the start of the replay.
const TWO_HAND_PINCH_AT = 6_600;
const FIST_AT = 3_200;
const ONE_LOOP = 9_700;

test("capture the README images from the fake hand replay @docs", async ({ browser }) => {
  test.setTimeout(60_000);
  const size = { width: 1280, height: 800 };
  const context = await browser.newContext({ viewport: size, recordVideo: { dir: test.info().outputPath("video"), size } });
  const page = await context.newPage();
  await page.goto("/?replay=demo");
  const started = Date.now();
  await page.waitForTimeout(TWO_HAND_PINCH_AT);
  await page.screenshot({ path: docs("screenshot.png") });
  await page.waitForTimeout(Math.max(0, ONE_LOOP - (Date.now() - started)));
  await context.close();
  await page.video()?.saveAs(docs("demo.webm"));

  const phone = await browser.newContext({ ...devices["Pixel 7"] });
  const mobile = await phone.newPage();
  await mobile.goto("/?replay=demo");
  await mobile.waitForTimeout(FIST_AT);
  await mobile.screenshot({ path: docs("screenshot-mobile.png") });
  await phone.close();
});
