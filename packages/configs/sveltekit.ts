import { type UserConfig, defineConfig } from "vite";

import adapter from "@sveltejs/adapter-node";
import { type Config, sveltekit } from "@sveltejs/kit/vite";

/**
 * Builds a Vite configuration with SvelteKit first in the plugin chain.
 *
 * SvelteKit reads its options from the plugin, so `kit` carries them; it deploys with the Node
 * adapter unless `kit` names another.
 */
export function SvelteKitVite(config: UserConfig = {}, kit: Config = {}): UserConfig {
  return defineConfig({
    ...config,
    plugins: [sveltekit({ ...kit, adapter: kit.adapter ?? adapter() }), ...(config.plugins ?? [])],
  });
}
