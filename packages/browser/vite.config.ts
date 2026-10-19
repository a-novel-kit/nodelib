import { libraryConfig } from "../../vite.library";
import manifest from "./package.json" with { type: "json" };

export default libraryConfig(
  {
    http: "packages/browser/http/index.ts",
    utils: "packages/browser/utils/index.ts",
  },
  manifest
);
