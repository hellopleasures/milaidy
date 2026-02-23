import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: [
      path.join(here, "test/**/*.test.ts"),
      path.join(here, "test/**/*.test.tsx"),
    ],
    setupFiles: [path.join(here, "test/setup.ts")],
    environment: "node",
    alias: {
      electron: path.join(here, "test/__mocks__/electron.ts"),
      "@elizaos/skills": path.join(here, "test/__mocks__/elizaos-skills.ts"),
    },
    testTimeout: 30000,
    globals: true,
  },
});
