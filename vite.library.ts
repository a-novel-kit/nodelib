import { type UserConfig, defineConfig } from "vite";

/** The manifest fields naming the packages a bundle leaves to the consumer. */
interface Manifest {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Builds the Vite configuration of one workspace package. Each entry becomes an ES module at
 * `<entry>/index.es.js`, except `index`, which lands at the root of `dist`.
 *
 * Every dependency and peer stays external, subpath imports included, so the consumer resolves one
 * copy of each.
 */
export function libraryConfig(entry: Record<string, string>, manifest: Manifest): UserConfig {
  const external = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies });

  return defineConfig({
    build: {
      lib: { entry, formats: ["es"] },
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
