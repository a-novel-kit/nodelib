import { name, peerDependencies } from "./package.json";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "packages/i18n/index.ts",
      },
      name,
      formats: ["es"],
    },
    ssr: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: "packages/i18n/index.ts",
      },
      output: {
        format: "es",
        entryFileNames: "index.es.js",
      },
      external: Object.keys(peerDependencies),
    },
  },
});
