import path from "node:path";

import { Eslint } from "@a-novel-kit/nodelib-config";

import { defineConfig } from "eslint/config";

export default defineConfig(
  ...Eslint({
    ignores: ["**/build/**", "packages/configs/fixtures/**/*.svelte"],
    gitIgnorePath: path.join(import.meta.dirname, ".gitignore"),
  })
);
