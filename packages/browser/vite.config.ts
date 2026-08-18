import { name, peerDependencies } from "./package.json" with { type: "json" };

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        http: "packages/browser/http/index.ts",
        utils: "packages/browser/utils/index.ts",
      },
      name,
      formats: ["es"],
    },
    ssr: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        http: "packages/browser/http/index.ts",
        utils: "packages/browser/utils/index.ts",
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
