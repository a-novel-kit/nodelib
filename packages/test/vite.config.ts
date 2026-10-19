import { libraryConfig } from "../../vite.library";
import manifest from "./package.json" with { type: "json" };

export default libraryConfig(
  {
    http: "packages/test/http/index.ts",
    playwright: "packages/test/playwright/index.ts",
  },
  manifest
);
