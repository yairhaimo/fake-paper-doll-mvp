import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 4173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
});
