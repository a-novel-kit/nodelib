import type { Plugin } from "vite";

import { parse } from "yaml";

const yamlModule = /\.ya?ml$/;

/** Yaml turns repository YAML files into JSON-compatible ES modules during a Vite build. */
export function Yaml(): Plugin {
  return {
    name: "a-novel:yaml-modules",
    transform(source, id) {
      const path = id.split("?", 1)[0];
      if (!path || !yamlModule.test(path)) return;

      const value: unknown = parse(source);
      const serialized = JSON.stringify(value);
      if (serialized === undefined) {
        throw new TypeError(`YAML module ${path} is not JSON-compatible`);
      }

      return {
        code: `export default ${serialized};`,
        map: null,
      };
    },
  };
}
