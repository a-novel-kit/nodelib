import { libraryConfig } from "../../vite.library.ts";
import manifest from "./package.json" with { type: "json" };

export default libraryConfig(import.meta.dirname, { index: "index.ts", svelte: "svelte.ts" }, manifest);
