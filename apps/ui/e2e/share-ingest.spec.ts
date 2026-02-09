import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers";

test.describe("Share ingest", () => {
  test("ingests native share payload into chat draft", async ({ page }) => {
    await mockApi(page, { agentState: "running" });
    await page.goto("/chat");

    // Verify chat is visible
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

    // Post share data via the API
    const resp = await page.evaluate(async () => {
      const r = await fetch("/api/ingest/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "test",
          title: "Test share",
          text: "Some shared text",
          url: "https://example.com",
          files: [{ name: "notes.md", mime: "text/markdown", base64: "aGVsbG8=" }],
        }),
      });
      return r.json();
    });

    expect(resp.ok).toBe(true);
  });
});
