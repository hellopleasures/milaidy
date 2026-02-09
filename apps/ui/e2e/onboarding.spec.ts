import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers.js";

test.describe("Onboarding Wizard", () => {
  test("shows welcome screen when onboarding is incomplete", async ({ page }) => {
    await mockApi(page, { onboardingComplete: false });
    await page.goto("/");
    await expect(page.getByText("Welcome to Milaidy")).toBeVisible();
  });

  test("navigates through name selection step", async ({ page }) => {
    await mockApi(page, { onboardingComplete: false });
    await page.goto("/");

    // Step 1: Welcome — click Next
    await page.getByText("Next").click();

    // Step 2: Name — heading is "Choose a Name"
    await expect(page.getByText("Choose a Name")).toBeVisible();
    await expect(page.getByText("Reimu")).toBeVisible();
    await expect(page.getByText("Flandre")).toBeVisible();

    // Select a preset name
    await page.getByText("Sakuya").click();
    await page.getByText("Next").click();

    // Step 3: Style
    await expect(page.getByText("Choose a Style")).toBeVisible();
  });

  test("allows custom name input", async ({ page }) => {
    await mockApi(page, { onboardingComplete: false });
    await page.goto("/");

    await page.getByText("Next").click();

    // Type custom name
    await page.getByPlaceholder("Enter custom name").fill("TestAgent");
    await page.getByText("Next").click();

    await expect(page.getByText("Choose a Style")).toBeVisible();
  });

  test("navigates through style selection step", async ({ page }) => {
    await mockApi(page, { onboardingComplete: false });
    await page.goto("/");

    // Get to style step
    await page.getByText("Next").click();
    await page.getByText("Reimu").click();
    await page.getByText("Next").click();

    // Step 3: Style
    await expect(page.getByText("Choose a Style")).toBeVisible();
    await expect(page.getByText("uwu~")).toBeVisible();
    await expect(page.getByText("hell yeah")).toBeVisible();
    await expect(page.getByText("Noted.")).toBeVisible();

    await page.getByText("uwu~").click();
    await page.getByText("Next").click();

    // Step 4: Theme
    await expect(page.getByText("Choose a Theme")).toBeVisible();
  });

  test("navigates through theme and run mode steps", async ({ page }) => {
    await mockApi(page, { onboardingComplete: false });
    await page.goto("/");

    // Navigate through wizard steps
    await page.getByText("Next").click(); // welcome → name
    await page.getByText("Reimu").click();
    await page.getByText("Next").click(); // name → style
    await page.getByText("uwu~").click();
    await page.getByText("Next").click(); // style → theme

    // Step 4: Theme
    await expect(page.getByText("Choose a Theme")).toBeVisible();
    await page.getByText("Next").click(); // theme → runMode

    // Step 5: Run mode
    await expect(page.getByText("Run Mode")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Local")).toBeVisible();
    await expect(page.getByText("Cloud")).toBeVisible();
  });

  test("shows provider options in local mode", async ({ page }) => {
    await mockApi(page, { onboardingComplete: false });
    await page.goto("/");

    // Navigate to provider step
    await page.getByText("Next").click(); // welcome → name
    await page.getByText("Reimu").click();
    await page.getByText("Next").click(); // name → style
    await page.getByText("uwu~").click();
    await page.getByText("Next").click(); // style → theme
    await page.getByText("Next").click(); // theme → runMode
    await page.getByText("Local").click();
    await page.getByText("Next").click(); // runMode → llmProvider

    // Should show LLM provider selection
    await expect(page.getByText("LLM Provider")).toBeVisible();
    await expect(page.getByText("Anthropic")).toBeVisible();
    await expect(page.getByText("OpenAI")).toBeVisible();
  });

  test("completes onboarding with local provider and API key", async ({ page }) => {
    await mockApi(page, { onboardingComplete: false, agentState: "running", agentName: "Reimu" });
    await page.goto("/");

    // Navigate through all steps
    await page.getByText("Next").click(); // welcome → name
    await page.getByText("Reimu").click();
    await page.getByText("Next").click(); // name → style
    await page.getByText("uwu~").click();
    await page.getByText("Next").click(); // style → theme
    await page.getByText("Next").click(); // theme → runMode
    await page.getByText("Local").click();
    await page.getByText("Next").click(); // runMode → llmProvider

    // Select a provider and enter an API key
    await page.getByText("Anthropic").click();
    await page.getByPlaceholder("Enter your API key").fill("sk-ant-test-key-12345");
    await page.getByText("Next").click(); // llmProvider → inventorySetup

    // Inventory setup step
    await expect(page.getByText("Inventory Setup")).toBeVisible();
    await page.getByText("Next").click(); // finish onboarding

    // Should now show the main app
    await expect(page.getByText("Reimu")).toBeVisible({ timeout: 10000 });
  });
});
