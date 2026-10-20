import { join } from "node:path";

import { type UserConfig, defineConfig } from "vite";

/** The manifest fields naming the packages a bundle leaves to the consumer. */
interface Manifest {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Builds the Vite configuration of the workspace package in `directory`. Each entry, a path relative
 * to `directory`, becomes an ES module at `dist/<entry>/index.es.js`, except `index`, which lands at
 * `dist/index.es.js`. Each build empties `dist` first.
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
          entryFileNames: ({ name }) => (name === "index" ? "index.es.js" : `${name}/index.es.js`),
        },
        external: (id) => external.some((name) => id === name || id.startsWith(`${name}/`)),
      },
    },
  });
}
