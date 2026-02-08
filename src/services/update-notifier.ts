/**
 * Startup update notifier — non-blocking background check that prints a
 * subtle notification if a newer version is available.
 *
 * This is intentionally fire-and-forget: it never delays CLI startup, and
 * any failure (network, parsing, etc.) is silently ignored. The user sees
 * a one-line hint at the bottom of the banner, similar to how npm/brew/etc.
 * surface update notices.
 *
 * Called from the preAction hook when `update.checkOnStart` is not `false`.
 */

import { loadMilaidyConfig } from "../config/config.js";
import { theme } from "../terminal/theme.js";
import { checkForUpdate, resolveChannel } from "./update-checker.js";

/** State flag to prevent duplicate notifications in a single process. */
let notified = false;

/**
 * Schedule a background update check. Resolves immediately (the check
 * runs asynchronously in the background). If an update is found, prints
 * a one-line notice to stderr so it doesn't interfere with piped output.
 */
export function scheduleUpdateNotification(): void {
  if (notified) return;
  notified = true;

  const config = loadMilaidyConfig();

  // Disabled by user
  if (config.update?.checkOnStart === false) return;

  // Don't check in CI or non-interactive environments
  if (process.env.CI || !process.stderr.isTTY) return;

  // Fire and forget — never block startup
  void checkForUpdate()
    .then((result) => {
      if (!result.updateAvailable || !result.latestVersion) return;

      const channel = resolveChannel(config.update);
      const channelSuffix = channel !== "stable" ? ` (${channel})` : "";

      // Use stderr so piped stdout is clean
      process.stderr.write(
        `\n${theme.accent("Update available:")} ${theme.muted(result.currentVersion)} -> ${theme.success(result.latestVersion)}${theme.muted(channelSuffix)}\n` +
          `${theme.muted("Run")} ${theme.command("milaidy update")} ${theme.muted("to install")}\n\n`,
      );
    })
    .catch(() => {
      // Silently ignore — never let update checks disrupt the CLI
    });
}
