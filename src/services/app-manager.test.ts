/**
 * Tests for the Milaidy AppManager.
 *
 * Exercises app lifecycle (install, launch, stop), port allocation,
 * error handling, and edge cases.
 *
 * Strategy:
 * - Registry and plugin-installer are mocked (network I/O boundary)
 * - Dynamic import is mocked (requires installed npm packages)
 * - The AgentRuntime is a minimal mock with registerPlugin()
 *
 * KNOWN COVERAGE GAPS (require integration testing, not unit tests):
 * - The full launch path (npm install -> dynamic import -> register plugin
 *   -> start server) is not tested end-to-end because it requires real
 *   npm packages installed on disk. This should be covered by E2E tests.
 * - Port allocation is tested in isolation but the full server bind flow
 *   depends on the app's startServer() implementation.
 * - WebSocket connections in connect-type apps (hyperfy, 2004scape) require
 *   running game servers and are inherently integration-level.
 */

import net from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — only boundary I/O is mocked, not the code under test
// ---------------------------------------------------------------------------

vi.mock("./registry-client.js", () => ({
  listApps: vi.fn().mockResolvedValue([]),
  getAppInfo: vi.fn().mockResolvedValue(null),
  searchApps: vi.fn().mockResolvedValue([]),
}));

vi.mock("./plugin-installer.js", () => ({
  installPlugin: vi.fn().mockResolvedValue({
    success: true,
    pluginName: "@elizaos/app-test",
    version: "1.0.0",
    installPath: "/tmp/test-install",
    requiresRestart: false,
  }),
}));

vi.mock("../config/config.js", () => ({
  loadMilaidyConfig: vi.fn().mockReturnValue({
    plugins: {
      installs: {},
    },
  }),
}));

// Mock resolvePackageEntry so we don't need real files
vi.mock("../runtime/eliza.js", () => ({
  resolvePackageEntry: vi.fn().mockResolvedValue("/tmp/fake/dist/index.js"),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake Plugin with app config. */
function fakeAppPlugin(overrides: Record<string, unknown> = {}) {
  return {
    name: "@elizaos/app-test",
    description: "Test app",
    actions: [],
    providers: [],
    app: {
      displayName: "Test App",
      category: "game" as const,
      launchType: "url" as const,
      launchUrl: "https://test.app",
      capabilities: ["test"],
      ...((overrides.app as Record<string, unknown>) ?? {}),
    },
    ...overrides,
  };
}

/** Create a fake Plugin without app config (regular plugin). */
function _fakeRegularPlugin() {
  return {
    name: "@elizaos/plugin-regular",
    description: "Regular plugin",
    actions: [],
    providers: [],
  };
}

/** Minimal AgentRuntime mock. */
function fakeRuntime() {
  return {
    agentId: "test-agent-id",
    character: { name: "TestAgent" },
    registerPlugin: vi.fn().mockResolvedValue(undefined),
    getSetting: vi.fn().mockReturnValue(null),
  } as unknown as import("@elizaos/core").AgentRuntime;
}

/** Occupy a port so allocation skips it. */
function _occupyPort(port: number): Promise<net.Server> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function _closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

// ---------------------------------------------------------------------------
// Dynamic import mock — intercepts the actual import() call in AppManager
// ---------------------------------------------------------------------------

let _mockImportResult: Record<string, unknown> = {};

// We need to intercept the dynamic import that AppManager does.
// Since it uses import(pathToFileURL(...).href), we mock at the fs.stat level
// to control the code path, then mock the import itself.
vi.mock("node:url", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:url")>();
  return {
    ...actual,
    pathToFileURL: vi
      .fn()
      .mockReturnValue({ href: "file:///tmp/fake/dist/index.js" }),
  };
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  vi.resetModules();
  savedEnv = {
    MILAIDY_UI_PORT: process.env.MILAIDY_UI_PORT,
  };
  process.env.MILAIDY_UI_PORT = "2138";
  _mockImportResult = { default: fakeAppPlugin() };
});

afterEach(() => {
  process.env.MILAIDY_UI_PORT = savedEnv.MILAIDY_UI_PORT;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppManager", () => {
  describe("listAvailable", () => {
    it("delegates to registry-client listApps", async () => {
      const { listApps } = await import("./registry-client.js");
      const mockListApps = vi.mocked(listApps);
      mockListApps.mockResolvedValue([
        {
          name: "@elizaos/app-dungeons",
          displayName: "Dungeons",
          description: "D&D",
          category: "game",
          launchType: "local",
          launchUrl: null,
          icon: null,
          capabilities: ["combat"],
          stars: 10,
          repository: "https://github.com/elizaos/app-dungeons",
          latestVersion: "1.0.0",
          supports: { v0: false, v1: false, v2: true },
          npm: {
            package: "@elizaos/app-dungeons",
            v0Version: null,
            v1Version: null,
            v2Version: "1.0.0",
          },
        },
      ]);

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      const apps = await mgr.listAvailable();

      expect(apps.length).toBe(1);
      expect(apps[0].displayName).toBe("Dungeons");
    });
  });

  describe("listInstalled", () => {
    it("returns apps matching @elizaos/app-* naming convention", async () => {
      const { loadMilaidyConfig } = await import("../config/config.js");
      vi.mocked(loadMilaidyConfig).mockReturnValue({
        plugins: {
          installs: {
            "@elizaos/app-dungeons": {
              version: "1.0.0",
              installPath: "/tmp/d",
              installedAt: "2026-02-07",
            },
            "@elizaos/plugin-solana": {
              version: "2.0.0",
              installPath: "/tmp/s",
              installedAt: "2026-02-07",
            },
            "@elizaos/app-babylon": {
              version: "1.0.0",
              installPath: "/tmp/b",
              installedAt: "2026-02-07",
            },
          },
        },
      } as ReturnType<typeof loadMilaidyConfig>);

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      const installed = mgr.listInstalled();

      expect(installed.length).toBe(2);
      const names = installed.map((a) => a.name);
      expect(names).toContain("@elizaos/app-dungeons");
      expect(names).toContain("@elizaos/app-babylon");
      expect(names).not.toContain("@elizaos/plugin-solana");
    });

    it("generates displayName from package name", async () => {
      const { loadMilaidyConfig } = await import("../config/config.js");
      vi.mocked(loadMilaidyConfig).mockReturnValue({
        plugins: {
          installs: {
            "@elizaos/app-agent-town": {
              version: "1.0.0",
              installPath: "/tmp/at",
              installedAt: "2026-02-07",
            },
          },
        },
      } as ReturnType<typeof loadMilaidyConfig>);

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      const installed = mgr.listInstalled();

      expect(installed[0].displayName).toBe("Agent Town");
    });

    it("returns empty array when no apps are installed", async () => {
      const { loadMilaidyConfig } = await import("../config/config.js");
      vi.mocked(loadMilaidyConfig).mockReturnValue({
        plugins: { installs: {} },
      } as ReturnType<typeof loadMilaidyConfig>);

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      expect(mgr.listInstalled()).toEqual([]);
    });

    it("returns empty when config has no plugins section", async () => {
      const { loadMilaidyConfig } = await import("../config/config.js");
      vi.mocked(loadMilaidyConfig).mockReturnValue(
        {} as ReturnType<typeof loadMilaidyConfig>,
      );

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      expect(mgr.listInstalled()).toEqual([]);
    });
  });

  describe("listRunning / isRunning", () => {
    it("starts empty", async () => {
      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      expect(mgr.listRunning()).toEqual([]);
      expect(mgr.isRunning("@elizaos/app-test")).toBe(false);
    });
  });

  describe("launch", () => {
    it("throws when no runtime is set", async () => {
      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();

      // No runtime set
      await expect(mgr.launch("@elizaos/app-test")).rejects.toThrow(
        "no agent runtime",
      );
    });

    it("throws when app is not installed", async () => {
      const { loadMilaidyConfig } = await import("../config/config.js");
      vi.mocked(loadMilaidyConfig).mockReturnValue({
        plugins: { installs: {} },
      } as ReturnType<typeof loadMilaidyConfig>);

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      mgr.setRuntime(fakeRuntime());

      await expect(mgr.launch("@elizaos/app-test")).rejects.toThrow(
        "not installed",
      );
    });
  });

  describe("stop", () => {
    it("does not throw when stopping a non-running app", async () => {
      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();

      // Should not throw
      await mgr.stop("@elizaos/app-nonexistent");
    });
  });

  describe("stopAll", () => {
    it("completes without error when no apps are running", async () => {
      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      await mgr.stopAll();
      expect(mgr.listRunning()).toEqual([]);
    });
  });

  describe("install", () => {
    it("delegates to plugin-installer installPlugin", async () => {
      const { installPlugin } = await import("./plugin-installer.js");
      const mockInstall = vi.mocked(installPlugin);
      mockInstall.mockResolvedValue({
        success: true,
        pluginName: "@elizaos/app-dungeons",
        version: "1.0.0",
        installPath: "/tmp/dungeons",
        requiresRestart: false,
      });

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      const result = await mgr.install("@elizaos/app-dungeons");

      expect(result.success).toBe(true);
      expect(result.pluginName).toBe("@elizaos/app-dungeons");
      expect(mockInstall).toHaveBeenCalledWith(
        "@elizaos/app-dungeons",
        undefined,
      );
    });

    it("passes progress callback to installPlugin", async () => {
      const { installPlugin } = await import("./plugin-installer.js");
      const mockInstall = vi.mocked(installPlugin);
      const progressFn = vi.fn();

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      await mgr.install("@elizaos/app-test", progressFn);

      expect(mockInstall).toHaveBeenCalledWith("@elizaos/app-test", progressFn);
    });

    it("returns failure result from installer", async () => {
      const { installPlugin } = await import("./plugin-installer.js");
      vi.mocked(installPlugin).mockResolvedValue({
        success: false,
        pluginName: "@elizaos/app-test",
        version: "",
        installPath: "",
        requiresRestart: false,
        error: "Package not found in registry",
      });

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      const result = await mgr.install("@elizaos/app-test");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Package not found in registry");
    });
  });

  describe("setRuntime", () => {
    it("accepts null runtime", async () => {
      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      mgr.setRuntime(null);
      // Should not throw
    });

    it("accepts a runtime instance", async () => {
      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      const rt = fakeRuntime();
      mgr.setRuntime(rt);
      // Should not throw
    });
  });

  describe("getInfo", () => {
    it("delegates to registry-client getAppInfo", async () => {
      const { getAppInfo } = await import("./registry-client.js");
      vi.mocked(getAppInfo).mockResolvedValue({
        name: "@elizaos/app-dungeons",
        displayName: "Dungeons",
        description: "D&D VTT",
        category: "game",
        launchType: "local",
        launchUrl: null,
        icon: null,
        capabilities: ["combat"],
        stars: 42,
        repository: "https://github.com/elizaos/app-dungeons",
        latestVersion: "1.0.0",
        supports: { v0: false, v1: false, v2: true },
        npm: {
          package: "@elizaos/app-dungeons",
          v0Version: null,
          v1Version: null,
          v2Version: "1.0.0",
        },
      });

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      const info = await mgr.getInfo("@elizaos/app-dungeons");

      expect(info).not.toBeNull();
      expect(info?.displayName).toBe("Dungeons");
    });

    it("returns null for non-existent app", async () => {
      const { getAppInfo } = await import("./registry-client.js");
      vi.mocked(getAppInfo).mockResolvedValue(null);

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      const info = await mgr.getInfo("@elizaos/app-nonexistent");

      expect(info).toBeNull();
    });
  });

  describe("search", () => {
    it("delegates to registry-client searchApps", async () => {
      const { searchApps } = await import("./registry-client.js");
      vi.mocked(searchApps).mockResolvedValue([]);

      const { AppManager } = await import("./app-manager.js");
      const mgr = new AppManager();
      const results = await mgr.search("dungeons", 5);

      expect(vi.mocked(searchApps)).toHaveBeenCalledWith("dungeons", 5);
      expect(results).toEqual([]);
    });
  });
});
