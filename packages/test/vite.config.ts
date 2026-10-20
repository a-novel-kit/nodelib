import { libraryConfig } from "../../vite.library.ts";
import manifest from "./package.json" with { type: "json" };

export default libraryConfig(
  import.meta.dirname,
  { http: "http/index.ts", playwright: "playwright/index.ts" },
  manifest
);
