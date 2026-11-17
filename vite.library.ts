import { join } from "node:path";

import { type UserConfig, defineConfig } from "vite";

/** The manifest fields naming the packages a bundle leaves to the consumer. */
interface Manifest {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Builds the Vite configuration of the workspace package in `directory`. Each entry maps a name to a
 * path relative to `directory`. The entry becomes an ES module at `dist/<name>/index.es.js`, and the
 * `index` entry lands at `dist/index.es.js`. Each build empties `dist` first.
 *
 * An entry written as `*.svelte.ts` holds runes, which only the consumer's Svelte compiler turns into
 * code, and it compiles only modules named `*.svelte.js`. Such an entry lands at
 * `dist/<name>/index.svelte.js`, its runes left as written.
 *
 * Every dependency and peer stays external, subpath imports included, so the consumer resolves one
 * copy of each.
 */
export function libraryConfig(directory: string, entry: Record<string, string>, manifest: Manifest): UserConfig {
  const external = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies });
  const entries = Object.entries(entry).map(([name, path]) => [name, join(directory, path)]);

  return defineConfig({
    build: {
      outDir: join(directory, "dist"),
      emptyOutDir: true,
      lib: { entry: Object.fromEntries(entries), formats: ["es"] },
      ssr: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          entryFileNames: ({ name }) => entryFileName(name, entry),
        },
        external: (id) => external.some((name) => id === name || id.startsWith(`${name}/`)),
      },
    },
  });
}

/** Names the file the entry `name` builds to, under `dist`. */
function entryFileName(name: string, entry: Record<string, string>): string {
  const file = entry[name]?.endsWith(".svelte.ts") ? "index.svelte.js" : "index.es.js";
  return name === "index" ? file : `${name}/${file}`;
}
