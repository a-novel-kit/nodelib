import { libraryConfig } from "../../vite.library";
import manifest from "./package.json" with { type: "json" };

export default libraryConfig(
  {
    index: "packages/i18n/index.ts",
    svelte: "packages/i18n/svelte.ts",
  },
  manifest
);
