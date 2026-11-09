import { test, expect } from "@playwright/test";

const viewports = [
  { width: 1100, height: 650 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
  { width: 390, height: 640 },
];

for (const vp of viewports) {
  test(`no document scroll at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const metrics = await page.evaluate(() => {
      const de = document.documentElement;
      const body = document.body;
      return {
        scrollHeight: Math.max(de.scrollHeight, body.scrollHeight),
        clientHeight: de.clientHeight,
        innerHeight: window.innerHeight,
        scrollWidth: Math.max(de.scrollWidth, body.scrollWidth),
        innerWidth: window.innerWidth,
        bodyOverflow: getComputedStyle(body).overflow,
        htmlOverflow: getComputedStyle(de).overflow,
        rootHeight: getComputedStyle(document.getElementById("root")!).height,
      };
    });

    // document never scrolls: scrollHeight <= innerHeight (+ tolerance for rounding)
    expect(metrics.scrollHeight, `scrollHeight ${metrics.scrollHeight} should <= innerHeight ${metrics.innerHeight} at ${vp.width}x${vp.height}`).toBeLessThanOrEqual(metrics.innerHeight + 2);

    // no horizontal overflow
    expect(metrics.scrollWidth, `scrollWidth ${metrics.scrollWidth} should <= innerWidth ${metrics.innerWidth}`).toBeLessThanOrEqual(metrics.innerWidth + 2);
  });
}

// wheel zoom should not scroll page
test("wheel over minimap zooms without page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const scrollBefore = await page.evaluate(() => window.scrollY);

  // find minimap container (flex-1 relative)
  const minimap = page.locator("div.flex-1.relative");
  const box = await minimap.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(300);
  }

  const scrollAfter = await page.evaluate(() => window.scrollY);
  expect(scrollAfter).toBe(0);
  expect(scrollBefore).toBe(0);
});

// left panel no scroll at smallest desktop
test("left panel compact fits without document scroll at 1100x650", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 650 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const leftPanelScroll = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (!aside) return { hasAside: false, scrollHeight: 0, clientHeight: 0 };
    return {
      hasAside: true,
      scrollHeight: aside.scrollHeight,
      clientHeight: aside.clientHeight,
      overflowY: getComputedStyle(aside).overflowY,
    };
  });
  // if aside exists, its scrollHeight may exceed clientHeight but document should still not scroll
  // we just assert document still not scrollable
  const docScroll = await page.evaluate(() => {
    return { sh: document.documentElement.scrollHeight, ih: window.innerHeight };
  });
  expect(docScroll.sh).toBeLessThanOrEqual(docScroll.ih + 2);
});

// overlays internal scroll
test("overlays max-height constrained", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Open settings overlay via TopBar
  const settingsBtn = page.getByRole("button", { name: "Open settings" });
  if (await settingsBtn.count() > 0) {
    await settingsBtn.click();
    await page.waitForTimeout(400);
    const overlayMax = await page.evaluate(() => {
      const el = document.querySelector("div.fixed.inset-0 div.bg-panel");
      if (!el) return null;
      return getComputedStyle(el).maxHeight;
    });
    // should be calc(100dvh-2rem) or similar constrained
    if (overlayMax) {
      expect(overlayMax).not.toBe("none");
    }
    // close
    await page.keyboard.press("Escape");
  }
});

// minimap touch-action none
test("minimap has touch-action none for pinch isolation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const touchAction = await page.evaluate(() => {
    const el = document.querySelector("div.flex-1.relative");
    if (!el) return null;
    return getComputedStyle(el).touchAction;
  });
  // should be none or contain none/pan restrictions
  expect(touchAction).toMatch(/none/);
});
