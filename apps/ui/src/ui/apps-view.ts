/**
 * Apps View — Unified Lit component for browsing, installing, and launching
 * ElizaOS apps and plugins from the registry.
 *
 * Combines the former "Apps" and "Marketplace" tabs into a single experience
 * with subtab filtering: Apps | Plugins | All.
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  client,
  type RegistryAppInfo,
  type InstalledAppInfo,
  type RunningAppInfo,
  type RegistryPluginItem,
} from "./api-client.js";

type SubTab = "apps" | "plugins" | "all";

const CATEGORY_LABELS: Record<string, string> = {
  game: "Game",
  social: "Social",
  platform: "Platform",
  world: "World",
};

const LAUNCH_TYPE_LABELS: Record<string, string> = {
  url: "Web App",
  local: "Local Server",
  connect: "Remote Server",
};

@customElement("apps-view")
export class AppsView extends LitElement {
  @state() private registryApps: RegistryAppInfo[] = [];
  @state() private registryPlugins: RegistryPluginItem[] = [];
  @state() private installedApps: InstalledAppInfo[] = [];
  @state() private runningApps: RunningAppInfo[] = [];
  @state() private loading = true;
  @state() private error: string | null = null;
  @state() private searchQuery = "";
  @state() private busyApp: string | null = null;
  @state() private busyAction: string | null = null;
  @state() private subTab: SubTab = "apps";

  static styles = css`
    :host {
      display: block;
      padding: 0;
    }

    /* ── Subtab bar ────────────────────────────────────────────────── */

    .subtab-bar {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0;
    }

    .subtab {
      padding: 8px 16px;
      border: none;
      background: none;
      color: var(--text-muted, #64748b);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
    }

    .subtab:hover {
      color: var(--text);
    }

    .subtab.active {
      color: var(--accent, #6366f1);
      border-bottom-color: var(--accent, #6366f1);
    }

    .subtab .count {
      display: inline-block;
      margin-left: 4px;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 11px;
      background: var(--badge-bg, #f1f5f9);
      color: var(--badge-text, #475569);
    }

    /* ── Search bar ────────────────────────────────────────────────── */

    .search-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .search-bar input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--input-bg, var(--card));
      color: var(--text);
      font-size: 14px;
      outline: none;
    }

    .search-bar input:focus {
      border-color: var(--accent, #6366f1);
    }

    /* ── Grid ──────────────────────────────────────────────────────── */

    .apps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    /* ── Card (shared) ─────────────────────────────────────────────── */

    .app-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      background: var(--card);
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: border-color 0.15s;
    }

    .app-card:hover {
      border-color: var(--accent, #6366f1);
    }

    .app-card.running {
      border-color: #22c55e;
      box-shadow: 0 0 0 1px #22c55e33;
    }

    .app-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .app-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--accent, #6366f1);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .app-icon.plugin-icon {
      background: #8b5cf6;
    }

    .app-icon img {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      object-fit: cover;
    }

    .app-title {
      font-weight: 600;
      font-size: 15px;
      color: var(--text-strong, var(--text));
    }

    .app-meta {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
      background: var(--badge-bg, #f1f5f9);
      color: var(--badge-text, #475569);
    }

    .badge.running {
      background: #dcfce7;
      color: #166534;
    }

    .badge.category {
      background: #ede9fe;
      color: #5b21b6;
    }

    .badge.launch-type {
      background: #e0f2fe;
      color: #0c4a6e;
    }

    .badge.plugin-badge {
      background: #f3e8ff;
      color: #7c3aed;
    }

    .badge.topic {
      background: var(--tag-bg, #f8fafc);
      color: var(--tag-text, #64748b);
    }

    .app-description {
      font-size: 13px;
      color: var(--text-muted, #64748b);
      line-height: 1.4;
      flex: 1;
    }

    .app-capabilities {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .capability-tag {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--tag-bg, #f8fafc);
      color: var(--tag-text, #64748b);
      border: 1px solid var(--border);
    }

    .app-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }

    .btn {
      padding: 6px 14px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--card);
      color: var(--text);
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.15s;
    }

    .btn:hover {
      background: var(--hover, #f1f5f9);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn.primary {
      background: var(--accent, #6366f1);
      color: white;
      border-color: var(--accent, #6366f1);
    }

    .btn.primary:hover {
      opacity: 0.9;
    }

    .btn.danger {
      color: #dc2626;
      border-color: #dc262644;
    }

    .btn.danger:hover {
      background: #fef2f2;
    }

    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: var(--text-muted, #64748b);
    }

    .empty-state h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text);
    }

    .error-banner {
      padding: 12px 16px;
      border-radius: 8px;
      background: #fef2f2;
      color: #991b1b;
      margin-bottom: 16px;
      font-size: 13px;
    }

    .loading {
      text-align: center;
      padding: 48px;
      color: var(--text-muted, #64748b);
    }

    .stars {
      font-size: 11px;
      color: var(--text-muted, #64748b);
    }

    .app-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .section-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted, #64748b);
      margin: 16px 0 8px;
    }

    .section-label:first-of-type {
      margin-top: 0;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadAll();
  }

  // ── Data loading ────────────────────────────────────────────────────

  private async loadAll() {
    this.loading = true;
    this.error = null;

    const [registryResult, pluginsResult, installedResult, runningResult] =
      await Promise.allSettled([
        client.listApps(),
        client.listRegistryPlugins(),
        client.listInstalledApps(),
        client.listRunningApps(),
      ]);

    if (registryResult.status === "fulfilled") {
      this.registryApps = registryResult.value;
    } else {
      this.error = `Failed to load apps: ${registryResult.reason instanceof Error ? registryResult.reason.message : String(registryResult.reason)}`;
    }

    if (pluginsResult.status === "fulfilled") {
      this.registryPlugins = pluginsResult.value;
    } else if (!this.error) {
      this.error = `Failed to load plugins: ${pluginsResult.reason instanceof Error ? pluginsResult.reason.message : String(pluginsResult.reason)}`;
    }

    if (installedResult.status === "fulfilled") {
      this.installedApps = installedResult.value;
    }

    if (runningResult.status === "fulfilled") {
      this.runningApps = runningResult.value;
    }

    this.loading = false;
  }

  private async handleRefresh() {
    this.loading = true;
    this.error = null;
    try {
      await client.refreshRegistry();
    } catch {
      // Refresh failed, loadAll will fetch from cache
    }
    await this.loadAll();
  }

  // ── App helpers ─────────────────────────────────────────────────────

  private isInstalled(name: string): boolean {
    return this.installedApps.some((a) => a.name === name);
  }

  private isRunning(name: string): boolean {
    return this.runningApps.some((a) => a.name === name);
  }

  private getRunningUrl(name: string): string | null {
    const running = this.runningApps.find((a) => a.name === name);
    return running?.url ?? null;
  }

  private async handleInstall(name: string) {
    this.busyApp = name;
    this.busyAction = "installing";
    this.error = null;

    let ok = false;
    const result = await client.installApp(name).catch((err: Error) => {
      this.error = `Install failed: ${err.message}`;
      return null;
    });
    if (result?.success) {
      ok = true;
    } else if (result && !result.success) {
      this.error = `Install failed: ${result.error ?? "unknown error"}`;
    }

    if (ok) await this.loadAll();
    this.busyApp = null;
    this.busyAction = null;
  }

  private async handleLaunch(name: string) {
    this.busyApp = name;
    this.busyAction = "launching";
    this.error = null;

    const result = await client.launchApp(name).catch((err: Error) => {
      this.error = `Launch failed: ${err.message}`;
      return null;
    });

    if (result?.url) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    }

    await this.loadAll();
    this.busyApp = null;
    this.busyAction = null;
  }

  private async handleStop(name: string) {
    this.busyApp = name;
    this.busyAction = "stopping";
    this.error = null;

    await client.stopApp(name).catch((err: Error) => {
      this.error = `Stop failed: ${err.message}`;
    });
    await this.loadAll();

    this.busyApp = null;
    this.busyAction = null;
  }

  private async handleSearch(e: InputEvent) {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;

    if (!this.searchQuery.trim()) {
      await this.loadAll();
      return;
    }

    this.loading = true;

    const [appsResult, pluginsResult] = await Promise.allSettled([
      client.searchApps(this.searchQuery).catch(() => [] as RegistryAppInfo[]),
      client.searchRegistryPlugins(this.searchQuery).catch(
        () => [] as RegistryPluginItem[],
      ),
    ]);

    this.registryApps =
      appsResult.status === "fulfilled" ? appsResult.value : [];
    this.registryPlugins =
      pluginsResult.status === "fulfilled" ? pluginsResult.value : [];
    this.loading = false;
  }

  // ── Rendering ───────────────────────────────────────────────────────

  private renderSubTabs() {
    const appCount = this.registryApps.length;
    const pluginCount = this.registryPlugins.length;
    const allCount = appCount + pluginCount;

    return html`
      <div class="subtab-bar">
        <button
          class="subtab ${this.subTab === "apps" ? "active" : ""}"
          @click=${() => {
            this.subTab = "apps";
          }}
        >
          Apps <span class="count">${appCount}</span>
        </button>
        <button
          class="subtab ${this.subTab === "plugins" ? "active" : ""}"
          @click=${() => {
            this.subTab = "plugins";
          }}
        >
          Plugins <span class="count">${pluginCount}</span>
        </button>
        <button
          class="subtab ${this.subTab === "all" ? "active" : ""}"
          @click=${() => {
            this.subTab = "all";
          }}
        >
          All <span class="count">${allCount}</span>
        </button>
      </div>
    `;
  }

  private renderAppCard(app: RegistryAppInfo) {
    const installed = this.isInstalled(app.name);
    const running = this.isRunning(app.name);
    const isBusy = this.busyApp === app.name;
    const runningUrl = this.getRunningUrl(app.name);
    const initial = app.displayName.charAt(0).toUpperCase();

    return html`
      <div class="app-card ${running ? "running" : ""}">
        <div class="app-header">
          <div class="app-icon">
            ${app.icon
              ? html`<img src="${app.icon}" alt="${app.displayName}" />`
              : initial}
          </div>
          <div>
            <div class="app-title">${app.displayName}</div>
            <div class="app-meta">
              <span class="badge category"
                >${CATEGORY_LABELS[app.category] ?? app.category}</span
              >
              <span class="badge launch-type"
                >${LAUNCH_TYPE_LABELS[app.launchType] ?? app.launchType}</span
              >
              ${running
                ? html`<span class="badge running">Playing</span>`
                : ""}
            </div>
          </div>
        </div>

        <div class="app-description">
          ${app.description || "No description available."}
        </div>

        ${app.capabilities.length > 0
          ? html`
              <div class="app-capabilities">
                ${app.capabilities.map(
                  (c) => html`<span class="capability-tag">${c}</span>`,
                )}
              </div>
            `
          : ""}

        <div class="app-footer">
          <span class="stars"
            >${app.stars > 0 ? `${app.stars} stars` : ""}</span
          >
          <div class="app-actions">
            ${running
              ? html`
                  ${runningUrl
                    ? html`<button
                        class="btn primary"
                        @click=${() =>
                          window.open(
                            runningUrl,
                            "_blank",
                            "noopener,noreferrer",
                          )}
                      >
                        Open
                      </button>`
                    : ""}
                  <button
                    class="btn danger"
                    ?disabled=${isBusy}
                    @click=${() => this.handleStop(app.name)}
                  >
                    ${isBusy && this.busyAction === "stopping"
                      ? "Stopping..."
                      : "Stop"}
                  </button>
                `
              : installed
                ? html`
                    <button
                      class="btn primary"
                      ?disabled=${isBusy}
                      @click=${() => this.handleLaunch(app.name)}
                    >
                      ${isBusy && this.busyAction === "launching"
                        ? "Launching..."
                        : "Launch"}
                    </button>
                  `
                : html`
                    <button
                      class="btn"
                      ?disabled=${isBusy}
                      @click=${() => this.handleInstall(app.name)}
                    >
                      ${isBusy && this.busyAction === "installing"
                        ? "Installing..."
                        : "Install"}
                    </button>
                  `}
          </div>
        </div>
      </div>
    `;
  }

  private renderPluginCard(plugin: RegistryPluginItem) {
    const isBusy = this.busyApp === plugin.name;
    const shortName = plugin.name.replace(/^@elizaos\//, "");
    const initial = shortName.charAt(0).toUpperCase();
    const version = plugin.latestVersion ?? "";
    const topicSlice = plugin.topics.slice(0, 4);

    return html`
      <div class="app-card">
        <div class="app-header">
          <div class="app-icon plugin-icon">${initial}</div>
          <div>
            <div class="app-title">${shortName}</div>
            <div class="app-meta">
              <span class="badge plugin-badge">Plugin</span>
              ${version ? html`<span class="badge">${version}</span>` : ""}
            </div>
          </div>
        </div>

        <div class="app-description">
          ${plugin.description || "No description available."}
        </div>

        ${topicSlice.length > 0
          ? html`
              <div class="app-capabilities">
                ${topicSlice.map(
                  (t) => html`<span class="capability-tag">${t}</span>`,
                )}
              </div>
            `
          : ""}

        <div class="app-footer">
          <span class="stars"
            >${plugin.stars > 0 ? `${plugin.stars} stars` : ""}</span
          >
          <div class="app-actions">
            <button
              class="btn"
              ?disabled=${isBusy}
              @click=${() => this.handleInstall(plugin.name)}
            >
              ${isBusy && this.busyAction === "installing"
                ? "Installing..."
                : "Install"}
            </button>
            ${plugin.repository
              ? html`<a
                  class="btn"
                  href="${plugin.repository}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="text-decoration:none"
                  >View</a
                >`
              : ""}
          </div>
        </div>
      </div>
    `;
  }

  private renderContent() {
    const showApps = this.subTab === "apps" || this.subTab === "all";
    const showPlugins = this.subTab === "plugins" || this.subTab === "all";

    const hasApps = this.registryApps.length > 0;
    const hasPlugins = this.registryPlugins.length > 0;
    const hasAnything = hasApps || hasPlugins;

    if (!hasAnything) {
      return html`
        <div class="empty-state">
          <h3>No items found</h3>
          <p>
            ${this.searchQuery
              ? "No results match your search. Try a different query."
              : "No apps or plugins are registered yet. Items will appear here once they are published to the ElizaOS registry."}
          </p>
        </div>
      `;
    }

    // In "all" mode, show apps first then plugins with section labels
    if (this.subTab === "all") {
      return html`
        ${hasApps
          ? html`
              <div class="section-label">Apps</div>
              <div class="apps-grid">
                ${this.registryApps.map((app) => this.renderAppCard(app))}
              </div>
            `
          : ""}
        ${hasPlugins
          ? html`
              <div class="section-label" style="${hasApps ? "margin-top:24px" : ""}">Plugins</div>
              <div class="apps-grid">
                ${this.registryPlugins.map((p) => this.renderPluginCard(p))}
              </div>
            `
          : ""}
      `;
    }

    if (showApps && !showPlugins) {
      if (!hasApps) {
        return html`
          <div class="empty-state">
            <h3>No apps found</h3>
            <p>
              ${this.searchQuery
                ? "No apps match your search. Try a different query."
                : "No apps are registered yet. Apps will appear here once they are published to the ElizaOS registry."}
            </p>
          </div>
        `;
      }
      return html`
        <div class="apps-grid">
          ${this.registryApps.map((app) => this.renderAppCard(app))}
        </div>
      `;
    }

    if (showPlugins && !showApps) {
      if (!hasPlugins) {
        return html`
          <div class="empty-state">
            <h3>No plugins found</h3>
            <p>
              ${this.searchQuery
                ? "No plugins match your search. Try a different query."
                : "No plugins are registered yet. Plugins will appear here once they are published to the ElizaOS registry."}
            </p>
          </div>
        `;
      }
      return html`
        <div class="apps-grid">
          ${this.registryPlugins.map((p) => this.renderPluginCard(p))}
        </div>
      `;
    }

    return html``;
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading registry...</div>`;
    }

    return html`
      ${this.error
        ? html`<div class="error-banner">${this.error}</div>`
        : ""}
      ${this.renderSubTabs()}

      <div class="search-bar">
        <input
          type="text"
          placeholder="Search apps and plugins..."
          .value=${this.searchQuery}
          @input=${this.handleSearch}
        />
        <button class="btn" @click=${() => this.handleRefresh()}>Refresh</button>
      </div>

      ${this.renderContent()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "apps-view": AppsView;
  }
}
