import { libraryConfig } from "../../vite.library.ts";
import manifest from "./package.json" with { type: "json" };

import { mergeConfig } from "vite";

const entries = {
  index: "index.ts",
  "eslint-svelte": "eslint-svelte.ts",
  i18next: "i18next.ts",
  "i18n-changes": "i18n-changes-cli.ts",
  playwright: "playwright.ts",
  sveltekit: "sveltekit.ts",
  "vitest-offline": "vitest-offline.ts",
  "vitest-sveltekit": "vitest-sveltekit.ts",
  yaml: "yaml.ts",
};

export default mergeConfig(libraryConfig(import.meta.dirname, entries, manifest), {
  build: {
    rollupOptions: {
      output: {
        // The command entry runs directly, so its chunk starts with a hashbang.
        banner: (chunk: { name: string }) => (chunk.name === "i18n-changes" ? "#!/usr/bin/env node" : ""),
      },
    },
  },
});
