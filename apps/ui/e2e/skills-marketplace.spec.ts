import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test.describe("Skills marketplace", () => {
  test("toggles loaded skill enablement", async ({ page }) => {
    await mockApi(page, { onboardingComplete: true, agentState: "running" });
    await page.goto("/skills");
    await page.waitForTimeout(500);

    // image-gen is disabled by default — find its toggle
    const toggle = page.locator("[data-skill-toggle='image-gen']");
    await expect(toggle).not.toBeChecked();
    await toggle.evaluate((el) => (el as HTMLInputElement).click());
    await expect(toggle).toBeChecked();
    await expect(page.getByText(/Image Generation enabled/i)).toBeVisible();
  });

  test("shows skill cards with edit and delete buttons", async ({ page }) => {
    await mockApi(page, { onboardingComplete: true, agentState: "running" });
    await page.goto("/skills");
    await page.waitForTimeout(500);

    // Verify skill cards are present
    await expect(page.locator("[data-skill-id]")).toHaveCount(3);
    await expect(page.getByText("Web Search")).toBeVisible();
    await expect(page.getByText("Code Review")).toBeVisible();

    // Edit and Delete buttons should be present
    await expect(page.locator("button").filter({ hasText: "Edit" }).first()).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "Del" }).first()).toBeVisible();
  });
});
