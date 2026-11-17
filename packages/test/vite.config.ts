import { ViteLibrary } from "../configs/vite-library.ts";
import manifest from "./package.json" with { type: "json" };

export default ViteLibrary(
  import.meta.dirname,
  { http: "http/index.ts", mailpit: "mailpit/index.ts", playwright: "playwright/index.ts" },
  manifest
);
