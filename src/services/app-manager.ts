/**
 * App Manager — manages app lifecycle: install, launch, stop.
 * @module services/app-manager
 */

import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AgentRuntime, Plugin, AppServerHandle } from "@elizaos/core";
import { logger } from "@elizaos/core";
import { loadMilaidyConfig } from "../config/config.js";
import { resolvePackageEntry } from "../runtime/eliza.js";
import { installPlugin, type ProgressCallback } from "./plugin-installer.js";
import {
  type RegistryAppInfo,
  getAppInfo as registryGetAppInfo,
  listApps as registryListApps,
  searchApps as registrySearchApps,
} from "./registry-client.js";
// Exported types
// ---------------------------------------------------------------------------

export interface RunningAppInfo {
  name: string;
  displayName: string;
  url: string;
  launchType: "url" | "local" | "connect";
  launchedAt: string;
  port: number | null;
}

export interface AppLaunchResult {
  url: string;
  launchType: "url" | "local" | "connect";
  displayName: string;
}

export interface InstalledAppInfo {
  name: string;
  displayName: string;
  version: string;
  installPath: string;
  installedAt: string;
  isRunning: boolean;
}

interface RunningApp {
  name: string;
  displayName: string;
  url: string;
  launchType: "url" | "local" | "connect";
  launchedAt: string;
  port: number | null;
  serverHandle: AppServerHandle | null;
  plugin: Plugin;
}

interface AppModuleExports {
  default?: Plugin;
  plugin?: Plugin;
  [key: string]: Plugin | undefined;
}

const PORT_RANGE_START = 19000;
const PORT_RANGE_END = 19100;
const allocatedPorts = new Set<number>();

async function allocatePort(preferredPort?: number): Promise<number> {
  if (
    preferredPort &&
    preferredPort >= PORT_RANGE_START &&
    preferredPort <= PORT_RANGE_END
  ) {
    if (
      !allocatedPorts.has(preferredPort) &&
      (await isPortAvailable(preferredPort))
    ) {
      allocatedPorts.add(preferredPort);
      return preferredPort;
    }
  }

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (allocatedPorts.has(port)) continue;
    if (await isPortAvailable(port)) {
      allocatedPorts.add(port);
      return port;
    }
  }

  throw new Error(
    `No available ports in range ${PORT_RANGE_START}–${PORT_RANGE_END}. ` +
      `${allocatedPorts.size} ports currently allocated.`,
  );
}

function releasePort(port: number): void {
  allocatedPorts.delete(port);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function importAppPlugin(
  installPath: string,
  packageName: string,
): Promise<Plugin> {
  const absPath = path.resolve(installPath);
  const nmCandidate = path.join(
    absPath,
    "node_modules",
    ...packageName.split("/"),
  );
  const nmStat = await fs.stat(nmCandidate).catch(() => null);
  const pkgRoot = nmStat?.isDirectory() ? nmCandidate : absPath;

  const entryPoint = await resolvePackageEntry(pkgRoot);
  const mod = (await import(
    pathToFileURL(entryPoint).href
  )) as AppModuleExports;

  const plugin = mod.default ?? mod.plugin;
  if (!plugin || typeof plugin.name !== "string") {
    throw new Error(
      `App package "${packageName}" does not export a valid Plugin. ` +
        `Expected a default or named 'plugin' export with a 'name' property.`,
    );
  }
  return plugin;
}

function isAppPackageName(name: string): boolean {
  return name.startsWith("@elizaos/app-") || name.startsWith("@elizaos-apps/");
}

function extractPortFromUrl(url: string): number | undefined {
  const match = /:(\d+)/.exec(url);
  return match ? Number(match[1]) : undefined;
}

function humanizePackageName(name: string): string {
  return name
    .replace(/^@elizaos\/app-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export class AppManager {
  private runningApps = new Map<string, RunningApp>();
  private runtime: AgentRuntime | null = null;

  setRuntime(runtime: AgentRuntime | null): void {
    this.runtime = runtime;
  }

  async listAvailable(): Promise<RegistryAppInfo[]> {
    return registryListApps();
  }

  async search(query: string, limit = 15): Promise<RegistryAppInfo[]> {
    return registrySearchApps(query, limit);
  }

  async getInfo(name: string): Promise<RegistryAppInfo | null> {
    return registryGetAppInfo(name);
  }

  async install(
    name: string,
    onProgress?: ProgressCallback,
  ): ReturnType<typeof installPlugin> {
    logger.info(`[app-manager] Installing app: ${name}`);
    return installPlugin(name, onProgress);
  }

  listInstalled(): InstalledAppInfo[] {
    const installs = loadMilaidyConfig().plugins?.installs ?? {};
    const apps: InstalledAppInfo[] = [];

    for (const [name, record] of Object.entries(installs)) {
      if (!isAppPackageName(name)) continue;
      apps.push({
        name,
        displayName: humanizePackageName(name),
        version: record.version ?? "unknown",
        installPath: record.installPath ?? "",
        installedAt: record.installedAt ?? "",
        isRunning: this.runningApps.has(name),
      });
    }
    return apps;
  }

  async launch(name: string): Promise<AppLaunchResult> {
    const existing = this.runningApps.get(name);
    if (existing) {
      return {
        url: existing.url,
        launchType: existing.launchType,
        displayName: existing.displayName,
      };
    }

    if (!this.runtime) {
      throw new Error(
        "Cannot launch app: no agent runtime is running. Start the agent first.",
      );
    }

    const installRecord = loadMilaidyConfig().plugins?.installs?.[name];
    if (!installRecord?.installPath) {
      throw new Error(`App "${name}" is not installed. Install it first.`);
    }

    logger.info(`[app-manager] Launching app: ${name}`);
    const plugin = await importAppPlugin(installRecord.installPath, name);

    const appConfig = plugin.app;
    if (!appConfig) {
      throw new Error(
        `Package "${name}" does not export app metadata. It may be a regular plugin.`,
      );
    }

    await this.runtime.registerPlugin(plugin);
    logger.info(
      `[app-manager] Plugin "${plugin.name}" registered (${plugin.actions?.length ?? 0} actions, ${plugin.providers?.length ?? 0} providers)`,
    );

    let url: string;
    let port: number | null = null;
    let serverHandle: AppServerHandle | null = null;
    const { launchType } = appConfig;

    if (launchType === "local") {
      if (!appConfig.startServer) {
        throw new Error(
          `App "${name}" declares launchType "local" but provides no startServer.`,
        );
      }

      port = await allocatePort(
        appConfig.launchUrl
          ? extractPortFromUrl(appConfig.launchUrl)
          : undefined,
      );

      const uiPort = process.env.MILAIDY_UI_PORT || "2138";
      serverHandle = await appConfig.startServer({
        port,
        agentRuntime: this.runtime,
        corsOrigins: [
          `http://localhost:${uiPort}`,
          `http://127.0.0.1:${uiPort}`,
          `http://localhost:${port}`,
          `http://127.0.0.1:${port}`,
        ],
      });
      url = serverHandle?.url;
      logger.info(`[app-manager] Local server started: ${url}`);
    } else {
      // "url" and "connect" both just open a URL; the plugin's service handles the connection
      url = appConfig.launchUrl ?? "";
      if (!url) {
        throw new Error(
          `App "${name}" declares launchType "${launchType}" but has no launchUrl.`,
        );
      }
      logger.info(`[app-manager] Opening ${launchType} app: ${url}`);
    }

    const displayName = appConfig.displayName ?? humanizePackageName(name);
    this.runningApps.set(name, {
      name,
      displayName,
      url,
      launchType,
      port,
      serverHandle,
      plugin,
      launchedAt: new Date().toISOString(),
    });

    return { url, launchType, displayName };
  }

  async stop(name: string): Promise<void> {
    const app = this.runningApps.get(name);
    if (!app) return;

    logger.info(`[app-manager] Stopping app: ${name}`);

    if (app.serverHandle) {
      await app.serverHandle.stop();
    }
    if (app.port !== null) {
      releasePort(app.port);
    }
    this.runningApps.delete(name);
  }

  async stopAll(): Promise<void> {
    for (const name of [...this.runningApps.keys()]) {
      await this.stop(name);
    }
  }

  listRunning(): RunningAppInfo[] {
    return [...this.runningApps.values()].map(
      ({ name, displayName, url, launchType, launchedAt, port }) => ({
        name,
        displayName,
        url,
        launchType,
        launchedAt,
        port,
      }),
    );
  }

  isRunning(name: string): boolean {
    return this.runningApps.has(name);
  }
}
