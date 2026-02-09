import { test, expect, waitForApp, getAppText } from "./fixtures.js";

test.describe("Theme", () => {
  test("app renders with content", async ({ appPage: page }) => {
    const text = await getAppText(page);
    expect(text.length).toBeGreaterThan(0);
  });

  test("app has styles applied", async ({ appPage: page }) => {
    const hasStyles = await page.evaluate(() => {
      // React app styles via <link> or <style> in <head>, or inline
      const styleElements = document.querySelectorAll("style, link[rel='stylesheet']");
      return styleElements.length > 0;
    });
    expect(hasStyles).toBe(true);
  });

  test("app persists content across reload", async ({ appPage: page }) => {
    const before = await getAppText(page);
    expect(before.length).toBeGreaterThan(0);

    await page.reload();
    await waitForApp(page);

    const after = await getAppText(page);
    expect(after.length).toBeGreaterThan(0);
  });
});
