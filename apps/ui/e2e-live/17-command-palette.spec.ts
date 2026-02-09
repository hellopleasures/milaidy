import { test, expect, getAppText } from "./fixtures.js";

test.describe("Command Palette", () => {
  test("command palette can be opened via keyboard", async ({ appPage: page }) => {
    // Verify Cmd+K / Ctrl+K opens the palette
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(300);
    // Check if a command palette input is visible
    const hasInput = await page.evaluate(() => {
      return document.querySelector("[data-command-input]") !== null
        || document.querySelector("input[placeholder*='search commands' i]") !== null;
    });
    expect(hasInput).toBe(true);
  });

  test("command palette closes on Escape", async ({ appPage: page }) => {
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const hasInput = await page.evaluate(() => {
      return document.querySelector("[data-command-input]") !== null
        || document.querySelector("input[placeholder*='search commands' i]") !== null;
    });
    expect(hasInput).toBe(false);
  });

  test("header has interactive buttons", async ({ appPage: page }) => {
    const buttonCount = await page.evaluate(() => {
      return document.querySelectorAll("button").length;
    });
    expect(buttonCount).toBeGreaterThan(0);
  });
});
