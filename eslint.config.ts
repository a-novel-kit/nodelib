import path from "node:path";

import { Eslint } from "@a-novel-kit/nodelib-config";

export default Eslint({
  ignores: ["**/build/**", "packages/configs/fixtures/**/*.svelte"],
  gitIgnorePath: path.join(import.meta.dirname, ".gitignore"),
});
