import { type UserConfig, defineConfig } from "vite";

import adapter from "@sveltejs/adapter-node";
import type { Config } from "@sveltejs/kit";
import { sveltekit } from "@sveltejs/kit/vite";

/** Builds an SSR SvelteKit configuration with the Node deployment adapter. */
export function SvelteKit(config: Config = {}): Config {
  return {
    ...config,
    kit: {
      ...config.kit,
      adapter: config.kit?.adapter ?? adapter(),
    },
  };
}

/** Builds a Vite configuration with SvelteKit first in the plugin chain. */
export function SvelteKitVite(config: UserConfig = {}): UserConfig {
  return defineConfig({
    ...config,
    plugins: [sveltekit(), ...(config.plugins ?? [])],
  });
}
