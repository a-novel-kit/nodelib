import { name, peerDependencies } from "./package.json" with { type: "json" };

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "packages/server/index.ts",
        telemetry: "packages/server/telemetry.ts",
      },
      name,
      formats: ["es"],
    },
    ssr: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: "packages/server/index.ts",
        telemetry: "packages/server/telemetry.ts",
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
