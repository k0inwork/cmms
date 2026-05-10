import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/.orch/**", "**/dist/**", "**/integration/**"],
    testTimeout: 10000,
  },
});
