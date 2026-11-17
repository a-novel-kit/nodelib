import { ViteLibrary } from "../configs/vite-library.ts";
import manifest from "./package.json" with { type: "json" };

export default ViteLibrary(import.meta.dirname, { index: "index.ts", svelte: "svelte.ts" }, manifest);
