import { name } from "./package.json" with { type: "json" };

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "packages/server/index.ts",
      },
      name,
      formats: ["es"],
    },
    ssr: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: "packages/server/index.ts",
      },
      output: {
        format: "es",
        entryFileNames: "index.es.js",
      },
    },
  },
});
