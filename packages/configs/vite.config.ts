import { name, peerDependencies } from "./package.json" with { type: "json" };

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "packages/configs/index.ts",
        i18next: "packages/configs/i18next.ts",
        sveltekit: "packages/configs/sveltekit.ts",
        "vitest-sveltekit": "packages/configs/vitest-sveltekit.ts",
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
        sveltekit: "packages/configs/sveltekit.ts",
        "vitest-sveltekit": "packages/configs/vitest-sveltekit.ts",
      },
      output: {
        format: "es",
        entryFileNames: (chunkInfo) => {
          const entryName = chunkInfo.name === "index" ? "index" : `${chunkInfo.name}/index`;
          return `${entryName}.es.js`;
        },
      },
      external: Object.keys(peerDependencies),
    },
  },
});
