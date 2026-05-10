import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.orch/**", "**/dist/**"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
