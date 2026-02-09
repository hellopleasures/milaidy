import { test, expect } from "@playwright/test";
import { mockApi } from "./helpers";

// ═══════════════════════════════════════════════════════════════════════════
// Header wallet icon
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Header — wallet icon", () => {
  test("shows wallet button when addresses are configured", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForTimeout(500);

    const walletWrapper = page.locator(".wallet-wrapper");
    await expect(walletWrapper).toBeVisible();
  });

  test("hides wallet button when no addresses configured", async ({ page }) => {
    await mockApi(page, { walletAddresses: null });
    await page.goto("/");
    await page.waitForTimeout(500);

    const walletWrapper = page.locator(".wallet-wrapper");
    await expect(walletWrapper).not.toBeVisible();
  });

  test("shows address tooltip on hover", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForTimeout(500);

    const walletWrapper = page.locator(".wallet-wrapper");
    await walletWrapper.hover();
    await page.waitForTimeout(300);

    await expect(page.locator(".wallet-tooltip")).toBeVisible();
    await expect(page.getByText("EVM")).toBeVisible();
    await expect(page.getByText("SOL")).toBeVisible();
  });

  test("shows copy buttons in tooltip", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForTimeout(500);

    const walletWrapper = page.locator(".wallet-wrapper");
    await walletWrapper.hover();
    await page.waitForTimeout(300);

    const copyButtons = page.locator(".wallet-tooltip button").filter({ hasText: "copy" });
    await expect(copyButtons).toHaveCount(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Navigation — inventory tab
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Navigation — inventory tab", () => {
  test("inventory tab appears in navigation", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForTimeout(300);

    const inventoryBtn = page.locator("nav button").filter({ hasText: "Inventory" });
    await expect(inventoryBtn).toBeVisible();
  });

  test("clicking inventory tab shows inventory page", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.locator("nav button").filter({ hasText: "Inventory" }).click();
    await page.waitForTimeout(300);

    // Inventory page should show setup or content
    await expect(page).toHaveURL(/\/inventory/);
  });

  test("direct navigation to /inventory works", async ({ page }) => {
    await mockApi(page);
    await page.goto("/inventory");
    await page.waitForTimeout(500);

    await expect(page).toHaveURL(/\/inventory/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Inventory — API key setup flow
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Inventory — setup flow (no API keys)", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { walletConfig: { alchemyKeySet: false, heliusKeySet: false } });
    await page.goto("/inventory");
    await page.waitForTimeout(500);
  });

  test("shows setup instructions when no API keys configured", async ({ page }) => {
    // Setup view shows EVM and Solana sections with API key cards
    await expect(page.getByRole("heading", { name: "EVM" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Alchemy" })).toBeVisible();
  });

  test("shows Alchemy setup card", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Alchemy" })).toBeVisible();
    await expect(page.locator("a[href*='alchemy.com']")).toBeVisible();
  });

  test("shows Helius setup card", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Helius" })).toBeVisible();
    await expect(page.locator("a[href*='helius']")).toBeVisible();
  });

  test("shows Save API Keys button", async ({ page }) => {
    await expect(page.locator("button").filter({ hasText: "Save API Keys" })).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Inventory — tokens view
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Inventory — tokens view", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { walletConfig: { alchemyKeySet: true, heliusKeySet: true } });
    await page.goto("/inventory");
    await page.waitForTimeout(1500);
    // Click the Tokens tab to trigger balance loading
    const tokensBtn = page.locator("button").filter({ hasText: "Tokens" }).first();
    if (await tokensBtn.isVisible().catch(() => false)) {
      await tokensBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  test("shows Tokens and NFTs sub-tabs", async ({ page }) => {
    await expect(page.locator("button").filter({ hasText: "Tokens" }).first()).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "NFTs" }).first()).toBeVisible();
  });

  test("shows sort buttons", async ({ page }) => {
    await expect(page.locator("button").filter({ hasText: "Value" }).first()).toBeVisible();
  });

  test("shows Refresh button", async ({ page }) => {
    await expect(page.locator("button").filter({ hasText: "Refresh" }).first()).toBeVisible();
  });

  test("renders a token table", async ({ page }) => {
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test("table has header row with columns", async ({ page }) => {
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    const headers = page.locator("table thead th");
    expect(await headers.count()).toBeGreaterThanOrEqual(4);
  });

  test("shows ETH token row", async ({ page }) => {
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    const ethRow = page.locator("table tbody tr").filter({ hasText: "ETH" }).first();
    await expect(ethRow).toBeVisible();
  });

  test("shows USDC rows", async ({ page }) => {
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    const usdcRows = page.locator("table tbody tr").filter({ hasText: "USDC" });
    expect(await usdcRows.count()).toBeGreaterThanOrEqual(2);
  });

  test("shows SOL token row", async ({ page }) => {
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    const solRow = page.locator("table tbody tr").filter({ hasText: "SOL" });
    await expect(solRow.first()).toBeVisible();
  });

  test("all tokens from all chains in one table", async ({ page }) => {
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
    const rows = page.locator("table tbody tr");
    expect(await rows.count()).toBeGreaterThanOrEqual(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Inventory — NFTs view
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Inventory — NFTs view", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { walletConfig: { alchemyKeySet: true, heliusKeySet: true } });
    await page.goto("/inventory");
    await page.waitForTimeout(1500);
    // Click NFTs tab to trigger NFT loading
    const nftsBtn = page.locator("button").filter({ hasText: "NFTs" }).first();
    if (await nftsBtn.isVisible().catch(() => false)) {
      await nftsBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  test("switching to NFTs tab shows NFTs", async ({ page }) => {
    // NFTs tab already clicked in beforeEach
    await expect(page.getByText("Bored Ape #1234")).toBeVisible({ timeout: 10000 });
  });

  test("shows Bored Ape NFT", async ({ page }) => {
    await expect(page.getByText("Bored Ape #1234")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Bored Ape Yacht Club")).toBeVisible();
  });

  test("shows Solana DRiP NFT", async ({ page }) => {
    await expect(page.getByText("DRiP Drop #42")).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Config — wallet API keys section
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Config — wallet API keys", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.locator("nav button").filter({ hasText: "Config" }).click();
    await page.waitForTimeout(500);
  });

  test("shows Wallet Providers section", async ({ page }) => {
    await expect(page.getByText("Wallet Providers & API Keys")).toBeVisible();
  });

  test("shows ALCHEMY_API_KEY input", async ({ page }) => {
    await expect(page.locator("code").filter({ hasText: "ALCHEMY_API_KEY" })).toBeVisible();
    await expect(page.locator("a[href*='dashboard.alchemy.com']")).toBeVisible();
  });

  test("shows HELIUS_API_KEY input", async ({ page }) => {
    await expect(page.locator("code").filter({ hasText: "HELIUS_API_KEY" })).toBeVisible();
    await expect(page.locator("a[href*='dev.helius.xyz']")).toBeVisible();
  });

  test("shows BIRDEYE_API_KEY input", async ({ page }) => {
    await expect(page.locator("code").filter({ hasText: "BIRDEYE_API_KEY" })).toBeVisible();
    await expect(page.locator("a[href*='birdeye.so']")).toBeVisible();
  });

  test("shows Save API Keys button", async ({ page }) => {
    const saveBtn = page.locator("button").filter({ hasText: "Save API Keys" });
    await expect(saveBtn.first()).toBeVisible();
  });

  test("shows set/not-set indicator for keys", async ({ page }) => {
    const notSetLabels = page.getByText("not set");
    expect(await notSetLabels.count()).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Config — key export (Danger Zone)
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Config — private key export", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.locator("nav button").filter({ hasText: "Config" }).click();
    await page.waitForTimeout(500);
  });

  test("shows Export Private Keys section in Danger Zone", async ({ page }) => {
    await expect(page.getByText("Export Private Keys")).toBeVisible();
    await expect(page.getByText("Never share these with anyone")).toBeVisible();
  });

  test("Export Keys button is visible", async ({ page }) => {
    await expect(page.locator("button").filter({ hasText: "Export Keys" })).toBeVisible();
  });

  test("clicking Export Keys shows confirmation dialog", async ({ page }) => {
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("private keys");
      await dialog.accept();
    });

    await page.locator("button").filter({ hasText: "Export Keys" }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText("EVM Private Key")).toBeVisible();
  });

  test("exported keys contain EVM and Solana sections", async ({ page }) => {
    page.on("dialog", async (dialog) => await dialog.accept());

    await page.locator("button").filter({ hasText: "Export Keys" }).click();
    await page.waitForTimeout(500);

    await expect(page.locator("strong").filter({ hasText: "EVM Private Key" })).toBeVisible();
    await expect(page.locator("strong").filter({ hasText: "Solana Private Key" })).toBeVisible();
  });

  test("exported keys have copy buttons", async ({ page }) => {
    page.on("dialog", async (dialog) => await dialog.accept());

    await page.locator("button").filter({ hasText: "Export Keys" }).click();
    await page.waitForTimeout(500);

    const copyButtons = page.locator("button").filter({ hasText: "copy" });
    expect(await copyButtons.count()).toBeGreaterThanOrEqual(2);
  });

  test("clicking Hide Keys hides the export section", async ({ page }) => {
    page.on("dialog", async (dialog) => await dialog.accept());

    await page.locator("button").filter({ hasText: "Export Keys" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("EVM Private Key")).toBeVisible();

    await page.locator("button").filter({ hasText: "Hide Keys" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText("EVM Private Key")).not.toBeVisible();
  });

  test("dismissing confirmation dialog does not show keys", async ({ page }) => {
    page.on("dialog", async (dialog) => await dialog.dismiss());

    await page.locator("button").filter({ hasText: "Export Keys" }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText("EVM Private Key")).not.toBeVisible();
  });
});
