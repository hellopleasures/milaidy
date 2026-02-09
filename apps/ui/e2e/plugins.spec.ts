import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers";

/** Click the ON/OFF toggle button for a plugin. */
async function clickToggle(page: import("@playwright/test").Page, pluginId: string): Promise<void> {
  await page.locator(`[data-plugin-toggle='${pluginId}']`).click();
}

test.describe("Plugins page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.locator("nav button").filter({ hasText: "Plugins" }).click();
    // Wait for plugin list to render (at least one plugin card visible)
    await expect(page.locator("[data-plugin-id]").first()).toBeVisible();
  });

  // --- Display ---

  test("displays plugin cards and filter buttons", async ({ page }) => {
    await expect(page.locator("button").filter({ hasText: "All" }).first()).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "AI Provider" })).toBeVisible();
  });

  test("lists all plugins from mock data", async ({ page }) => {
    const items = page.locator("[data-plugin-id]");
    // 12 default plugins minus 1 database plugin = 11 displayed
    await expect(items).toHaveCount(11);
  });

  test("shows plugin names", async ({ page }) => {
    await expect(page.getByText("Anthropic", { exact: true })).toBeVisible();
    await expect(page.getByText("OpenAI", { exact: true })).toBeVisible();
  });

  test("shows enabled/disabled toggle for each plugin", async ({ page }) => {
    const toggles = page.locator("[data-plugin-toggle]");
    await expect(toggles).toHaveCount(11);
  });

  test("enabled plugins show ON text", async ({ page }) => {
    const anthropicToggle = page.locator("[data-plugin-toggle='anthropic']");
    await expect(anthropicToggle).toHaveText("ON");
  });

  test("disabled plugins show OFF text", async ({ page }) => {
    const groqToggle = page.locator("[data-plugin-toggle='groq']");
    await expect(groqToggle).toHaveText("OFF");
  });

  test("blocks enabling plugin when required settings are missing and shows reason", async ({ page }) => {
    const groqToggle = page.locator("[data-plugin-toggle='groq']");
    await expect(groqToggle).toHaveText("OFF");

    let requested = false;
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes("/api/plugins/groq")) {
        requested = true;
      }
    });

    await groqToggle.click();
    await page.waitForTimeout(250);

    expect(requested).toBe(false);
    await expect(groqToggle).toHaveText("OFF");
    await expect(page.getByText(/Cannot enable Groq/i)).toBeVisible();
  });

  // --- Toggle ON: disabled -> enabled ---

  test("toggling a disabled plugin ON sends PUT with enabled:true", async ({ page }) => {
    const requestPromise = page.waitForRequest((req) =>
      req.url().includes("/api/plugins/ollama") && req.method() === "PUT",
    );

    await clickToggle(page, "ollama");

    const request = await requestPromise;
    const body = request.postDataJSON() as { enabled: boolean };
    expect(body.enabled).toBe(true);
  });

  test("toggling a disabled plugin ON updates the toggle text", async ({ page }) => {
    const ollamaToggle = page.locator("[data-plugin-toggle='ollama']");
    await expect(ollamaToggle).toHaveText("OFF");

    await clickToggle(page, "ollama");
    await expect(ollamaToggle).toHaveText("ON");
  });

  // --- Toggle OFF: enabled -> disabled ---

  test("toggling an enabled plugin OFF sends PUT with enabled:false", async ({ page }) => {
    const requestPromise = page.waitForRequest((req) =>
      req.url().includes("/api/plugins/anthropic") && req.method() === "PUT",
    );

    await clickToggle(page, "anthropic");

    const request = await requestPromise;
    const body = request.postDataJSON() as { enabled: boolean };
    expect(body.enabled).toBe(false);
  });

  test("toggling an enabled plugin OFF updates the toggle text", async ({ page }) => {
    const anthropicToggle = page.locator("[data-plugin-toggle='anthropic']");
    await expect(anthropicToggle).toHaveText("ON");

    await clickToggle(page, "anthropic");
    await expect(anthropicToggle).toHaveText("OFF");
  });

  // --- Toggle round-trip: OFF -> ON -> OFF ---

  test("plugin toggle round-trip: disable then re-enable", async ({ page }) => {
    const browserToggle = page.locator("[data-plugin-toggle='browser']");
    await expect(browserToggle).toHaveText("ON");

    await browserToggle.click();
    await expect(browserToggle).toHaveText("OFF");

    await browserToggle.click();
    await expect(browserToggle).toHaveText("ON");
  });

  // --- Multiple plugin toggles ---

  test("can toggle multiple plugins independently", async ({ page }) => {
    const ollama = page.locator("[data-plugin-toggle='ollama']");
    const cron = page.locator("[data-plugin-toggle='cron']");

    await expect(ollama).toHaveText("OFF");
    await expect(cron).toHaveText("OFF");

    await ollama.click();
    await cron.click();

    await expect(ollama).toHaveText("ON");
    await expect(cron).toHaveText("ON");
  });

  // --- Category filtering ---

  test("shows category filter buttons", async ({ page }) => {
    await expect(page.locator("button").filter({ hasText: "All" }).first()).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "AI Provider" })).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "Connector" })).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "Feature" })).toBeVisible();
  });
});
