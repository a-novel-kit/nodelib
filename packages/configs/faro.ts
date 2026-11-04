import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import type { Plugin } from "vite";

/** FaroSourceMapsOptions names where a release build sends the browser's source maps. */
export interface FaroSourceMapsOptions {
  /** Names the platform as its Faro SDK does, such as `platform-studio`. */
  appName: string;
  /** Faro's API base for the stack's region, such as `https://faro-api-prod-eu-west-2.grafana.net/faro`. */
  endpoint: string;
  /** The Grafana Cloud stack's numeric ID. */
  stackId: number;
}

/**
 * FaroSourceMaps sends the browser's source maps to the platform's Faro app, then deletes them before
 * the adapter copies the client, so the build ships none. It acts only when the build holds
 * `FARO_SOURCEMAP_API_KEY`, which then needs `FARO_SOURCEMAP_APP_ID`. A failed upload fails the build.
 *
 * Faro finds a map by the bundle ID each chunk records under the app name its SDK reads. Rolldown
 * writes the ID as a banner, which keeps the maps exact.
 */
export function FaroSourceMaps(
  { appName, endpoint, stackId }: FaroSourceMapsOptions,
  env: Record<string, string | undefined> = process.env
): Plugin | null {
  const apiKey = env.FARO_SOURCEMAP_API_KEY;
  if (!apiKey) return null;

  const appId = env.FARO_SOURCEMAP_APP_ID;
  if (!appId) throw new Error("FARO_SOURCEMAP_APP_ID names no Faro app to send the source maps to.");

  const bundleId = crypto.randomUUID();
  const banner = `globalThis[${JSON.stringify(`__faroBundleId_${appName}`)}]=${JSON.stringify(bundleId)};`;
  const url = `${endpoint}/api/v1/app/${appId}/sourcemaps/${bundleId}`;

  return {
    name: "a-novel:faro-source-maps",
    configEnvironment: (name) =>
      name === "client" ? { build: { sourcemap: "hidden", rolldownOptions: { output: { banner } } } } : undefined,
    applyToEnvironment: (environment) => environment.name === "client",
    async writeBundle({ dir = "" }, bundle) {
      for (const file of Object.keys(bundle).filter((name) => name.endsWith(".map"))) {
        const map = path.join(dir, file);
        const response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${stackId}:${apiKey}`, "Content-Type": "application/json" },
          body: await readFile(map),
        });
        // An unread body holds its connection until the server closes it.
        await response.body?.cancel();
        if (!response.ok) throw new Error(`Faro refused ${file} with status ${response.status}.`);
        await rm(map);
      }
    },
  };
}
