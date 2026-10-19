import { libraryConfig } from "../../vite.library";
import manifest from "./package.json" with { type: "json" };

export default libraryConfig(
  {
    index: "packages/server/index.ts",
    telemetry: "packages/server/telemetry.ts",
  },
  manifest
);
