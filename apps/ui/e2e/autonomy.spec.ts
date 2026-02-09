import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers";

test.describe("Autonomy indicator", () => {
  test("autonomy indicator is visible in header", async ({ page }) => {
    await mockApi(page, { agentState: "running" });
    await page.goto("/chat");
    // The header should be visible (autonomy status is shown in status pill)
    await expect(page.locator("header")).toBeVisible();
  });

  test("there is no autonomy toggle checkbox", async ({ page }) => {
    await mockApi(page, { agentState: "running" });
    await page.goto("/chat");
    // No autonomy toggle in the header
    await expect(page.locator("[data-action='autonomy-toggle']")).toHaveCount(0);
  });
});
