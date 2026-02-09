import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test.describe("MCP server configuration", () => {
  test("MCP config API is available", async ({ page }) => {
    await mockApi(page, { onboardingComplete: true, agentState: "running" });
    await page.goto("/config");

    // The config page should load and show settings
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("MCP config endpoint returns empty servers initially", async ({ page }) => {
    await mockApi(page, { onboardingComplete: true, agentState: "running" });
    await page.goto("/config");

    // Call the MCP config API directly
    const response = await page.evaluate(async () => {
      const resp = await fetch("/api/mcp/config");
      return resp.json();
    });

    expect(response.ok).toBe(true);
    expect(Object.keys(response.servers)).toHaveLength(0);
  });

  test("MCP status endpoint returns empty servers initially", async ({ page }) => {
    await mockApi(page, { onboardingComplete: true, agentState: "running" });
    await page.goto("/config");

    const response = await page.evaluate(async () => {
      const resp = await fetch("/api/mcp/status");
      return resp.json();
    });

    expect(response.ok).toBe(true);
    expect(response.servers).toHaveLength(0);
  });

  test("can add and remove an MCP server via API", async ({ page }) => {
    await mockApi(page, { onboardingComplete: true, agentState: "running" });
    await page.goto("/config");

    // Add a server
    const addResponse = await page.evaluate(async () => {
      const resp = await fetch("/api/mcp/config/server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "test-server",
          config: { command: "npx", args: ["-y", "test-server"] },
        }),
      });
      return resp.json();
    });

    expect(addResponse.ok).toBe(true);

    // Verify it's in the config
    const configResponse = await page.evaluate(async () => {
      const resp = await fetch("/api/mcp/config");
      return resp.json();
    });

    expect(configResponse.servers["test-server"]).toBeDefined();

    // Remove it
    const removeResponse = await page.evaluate(async () => {
      const resp = await fetch("/api/mcp/config/server/test-server", { method: "DELETE" });
      return resp.json();
    });

    expect(removeResponse.ok).toBe(true);
  });

  test("MCP marketplace search returns results", async ({ page }) => {
    await mockApi(page, { onboardingComplete: true, agentState: "running" });
    await page.goto("/config");

    const response = await page.evaluate(async () => {
      const resp = await fetch("/api/mcp/marketplace/search?q=github");
      return resp.json();
    });

    expect(response.ok).toBe(true);
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0].title).toBe("GitHub");
  });
});
