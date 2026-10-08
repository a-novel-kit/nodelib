import { dependencies, name, peerDependencies } from "./package.json" with { type: "json" };

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "packages/configs/index.ts",
        i18next: "packages/configs/i18next.ts",
        "i18n-changes": "packages/configs/i18n-changes-cli.ts",
        playwright: "packages/configs/playwright.ts",
        sveltekit: "packages/configs/sveltekit.ts",
        "vitest-sveltekit": "packages/configs/vitest-sveltekit.ts",
        yaml: "packages/configs/yaml.ts",
      },
      name,
      formats: ["es"],
    },
    ssr: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: "packages/configs/index.ts",
        i18next: "packages/configs/i18next.ts",
        "i18n-changes": "packages/configs/i18n-changes-cli.ts",
        playwright: "packages/configs/playwright.ts",
        sveltekit: "packages/configs/sveltekit.ts",
        "vitest-sveltekit": "packages/configs/vitest-sveltekit.ts",
        yaml: "packages/configs/yaml.ts",
      },
      output: {
        format: "es",
        // The command entry runs directly, so its chunk starts with a hashbang.
        banner: (chunk) => (chunk.name === "i18n-changes" ? "#!/usr/bin/env node" : ""),
        entryFileNames: (chunkInfo) => {
          const entryName = chunkInfo.name === "index" ? "index" : `${chunkInfo.name}/index`;
          return `${entryName}.es.js`;
        },
      },
      // A package's subpath imports, such as `playwright/test`, stay external with the package.
      external: (id) =>
        [...Object.keys(dependencies), ...Object.keys(peerDependencies)].some(
          (name) => id === name || id.startsWith(`${name}/`)
        ),
    },
  },
});
