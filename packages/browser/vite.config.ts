import { libraryConfig } from "../../vite.library.ts";
import manifest from "./package.json" with { type: "json" };

export default libraryConfig(
  import.meta.dirname,
  { http: "http/index.ts", telemetry: "telemetry/index.ts", utils: "utils/index.ts" },
  manifest
);
