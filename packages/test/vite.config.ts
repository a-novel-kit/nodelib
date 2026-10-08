import { name, peerDependencies } from "./package.json" with { type: "json" };

import path from "node:path";
import url from "node:url";

import { defineConfig } from "vite";

const _dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@a-novel-kit/nodelib-browser": path.resolve(_dirname, "../browser"),
    },
  },
  build: {
    lib: {
      entry: {
        http: "packages/test/http/index.ts",
        playwright: "packages/test/playwright/index.ts",
      },
      name,
      formats: ["es"],
    },
    ssr: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        http: "packages/test/http/index.ts",
        playwright: "packages/test/playwright/index.ts",
      },
      output: {
        format: "es",
        entryFileNames: (chunkInfo) => {
          const entryName = chunkInfo.name === "index" ? "index" : `${chunkInfo.name}/index`;
          return `${entryName}.es.js`;
        },
      },
      // A package's subpath imports, such as `playwright/test`, stay external with the package.
      external: (id) => Object.keys(peerDependencies).some((name) => id === name || id.startsWith(`${name}/`)),
    },
  },
});
