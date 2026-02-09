import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test.describe("Marketplace (Plugins page — Add Plugin)", () => {
  test("renders registry plugins on plugins page", async ({ page }) => {
    await mockApi(page, { onboardingComplete: true, agentState: "running" });
    await page.goto("/plugins");

    await expect(page.locator("[data-plugin-id]").first()).toBeVisible();
    await expect(page.getByText("Anthropic", { exact: true })).toBeVisible();
    await expect(page.getByText("OpenAI", { exact: true })).toBeVisible();
  });

  test("plugin cards show ON/OFF toggles", async ({ page }) => {
    await mockApi(page, { onboardingComplete: true, agentState: "running" });
    await page.goto("/plugins");

    // Anthropic is enabled
    await expect(page.locator("[data-plugin-toggle='anthropic']")).toHaveText("ON");
    // Groq is disabled
    await expect(page.locator("[data-plugin-toggle='groq']")).toHaveText("OFF");
  });
});
