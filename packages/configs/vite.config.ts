import { libraryConfig } from "../../vite.library";
import manifest from "./package.json" with { type: "json" };

import { mergeConfig } from "vite";

export default mergeConfig(
  libraryConfig(
    {
      index: "packages/configs/index.ts",
      i18next: "packages/configs/i18next.ts",
      "i18n-changes": "packages/configs/i18n-changes-cli.ts",
      playwright: "packages/configs/playwright.ts",
      sveltekit: "packages/configs/sveltekit.ts",
      "vitest-sveltekit": "packages/configs/vitest-sveltekit.ts",
      yaml: "packages/configs/yaml.ts",
    },
    manifest
  ),
  {
    build: {
      rollupOptions: {
        output: {
          // The command entry runs directly, so its chunk starts with a hashbang.
          banner: (chunk: { name: string }) => (chunk.name === "i18n-changes" ? "#!/usr/bin/env node" : ""),
        },
      },
    },
  }
);
