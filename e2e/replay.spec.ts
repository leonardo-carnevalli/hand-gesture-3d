import { expect, test, type Locator, type Page } from "@playwright/test";
import { PNG } from "pngjs";

/** Counts distinct (coarsely bucketed) colours: a blank or failed WebGL canvas has only a handful. */
async function distinctColours(page: Page): Promise<number> {
  const png = PNG.sync.read(await page.locator("[data-testid=stage] canvas").first().screenshot());
  const seen = new Set<number>();
  for (let i = 0; i < png.data.length; i += 4 * 7) {
    seen.add(((png.data[i] >> 3) << 10) | ((png.data[i + 1] >> 3) << 5) | (png.data[i + 2] >> 3));
  }
  return seen.size;
}

const num = async (stage: Locator, attr: string) => Number(await stage.getAttribute(attr));

test("the fake hand replay renders the scene and drives the selected object", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?replay=demo");
  const stage = page.getByTestId("stage");
  await expect(stage).toHaveAttribute("data-mode", "replay");

  await expect.poll(() => distinctColours(page), { timeout: 15_000 }).toBeGreaterThan(150);

  // Point, then pinch over the centre of the frame. On a phone the stacked layout puts no object there.
  if (!isMobile) await expect(stage).toHaveAttribute("data-selected", "Torus knot", { timeout: 15_000 });
  // Fist and drag: it rotates.
  await expect.poll(async () => Math.abs(await num(stage, "data-rotation-y")), { timeout: 15_000 }).toBeGreaterThan(15);
  // Two-hand pinch pulled apart: it grows.
  await expect.poll(() => num(stage, "data-scale"), { timeout: 15_000 }).toBeGreaterThan(1.3);
  // Open palm held: everything resets.
  await expect.poll(() => num(stage, "data-scale"), { timeout: 15_000 }).toBeLessThan(1.001);
  expect(Math.abs(await num(stage, "data-rotation-y"))).toBeLessThan(0.5);

  await expect(page.getByTestId("fps")).toContainText(/\d+ fps/);
  expect(errors).toEqual([]);
});

test("mouse fallback works without a camera", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use mouse or touch instead" }).click();
  const stage = page.getByTestId("stage");
  await expect(stage).toHaveAttribute("data-mode", "mouse");
  await expect(stage).toHaveAttribute("data-selected", "Icosahedron");

  const box = (await stage.boundingBox())!;
  // A point on the torus knot's tube (its centre is a hole): in the row on desktop, the middle of the stack on a phone.
  const cx = box.x + box.width * (isMobile ? 0.36 : 0.5);
  const cy = box.y + box.height * (isMobile ? 0.33 : 0.45);
  if (isMobile) {
    await page.touchscreen.tap(cx, cy);
  } else {
    await page.mouse.click(cx, cy);
  }
  await expect(stage).toHaveAttribute("data-selected", "Torus knot");

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 200, cy, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs(await num(stage, "data-rotation-y"))).toBeGreaterThan(20);

  await page.mouse.dblclick(cx, cy);
  await expect.poll(async () => Math.abs(await num(stage, "data-rotation-y"))).toBeLessThan(0.5);
});

test("camera denial falls back to mouse with an explanation", async ({ page, context }) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Enable camera" }).click();
  await expect(page.getByRole("status")).toContainText("permission was denied");
  await expect(page.getByTestId("stage")).toHaveAttribute("data-mode", "mouse");
});
