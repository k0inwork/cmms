import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/.orch/**", "**/dist/**"],
    testTimeout: 10000,
  },
});
