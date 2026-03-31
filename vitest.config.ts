import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    testTimeout: 30000,
    hookTimeout: 30000,
    envDir: ".",
    fileParallelism: false,
  },
  resolve: { conditions: ["node", "import"] },
});
