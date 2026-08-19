import { builtinModules } from "node:module";

import { defineConfig } from "vitest/config";

const NODE_BUILT_IN_MODULES = builtinModules.filter((m) => !m.startsWith("_"));
NODE_BUILT_IN_MODULES.push(...NODE_BUILT_IN_MODULES.map((m) => `node:${m}`));

export default defineConfig({
  optimizeDeps: {
    exclude: NODE_BUILT_IN_MODULES,
  },
  build: {
    minify: false,
  },
  test: {
    globals: true,
    environment: "jsdom",
    provide: {
      globalConfigValue: true,
    },
    coverage: {
      enabled: true,
      clean: true,
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "packages/browser/**/*.{ts,tsx}",
        "packages/configs/**/*.ts",
        "packages/i18n/**/*.ts",
        "packages/server/**/*.ts",
        "packages/test/**/*.{ts,tsx}",
      ],
      exclude: [
        "packages/browser/dist",
        "packages/configs/dist",
        "packages/i18n/dist",
        "packages/server/dist",
        "packages/test/dist",
      ],
      allowExternal: true,
    },
    // Every package holding tests needs an entry here. Vitest collects only from registered
    // projects, so a package left out is never run and silently reports no failures.
    projects: [
      {
        root: "packages/browser",
        extends: true,
      },
      {
        root: "packages/configs",
        extends: true,
      },
      {
        root: "packages/i18n",
        extends: true,
      },
      {
        root: "packages/server",
        extends: true,
      },
      {
        root: "packages/test",
        extends: true,
      },
    ],
  },
});
