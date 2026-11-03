import { type UserConfig, defineConfig } from "vite";

import adapter from "@sveltejs/adapter-node";
import { type Config, sveltekit } from "@sveltejs/kit/vite";

/**
 * The Content Security Policy every page sends (CSP Level 3). SvelteKit adds a nonce, or a hash on a
 * prerendered page, to `script-src` for its own inline scripts, so only the application's bundled
 * scripts run. No page loads a plugin or a `<base>` element, and no other site may frame a page.
 *
 * `form-action` stays open. A sign-in form redirects to the account platform, whose origin each
 * deployment configures at runtime, and a second policy only narrows this one, so the platform sends
 * `form-action 'self' <origin>` from its runtime configuration.
 */
const directives = {
  "script-src": ["self"],
  "object-src": ["none"],
  "base-uri": ["none"],
  "frame-ancestors": ["none"],
} satisfies NonNullable<Config["csp"]>["directives"];

/**
 * Builds a Vite configuration with SvelteKit first in the plugin chain.
 *
 * SvelteKit reads its options from the plugin, so `kit` carries them. The application deploys with
 * the Node adapter unless `kit` names another. Every page sends the default policy above; each
 * directive in `kit.csp.directives` adds to it or replaces the default one of that name.
 */
export function SvelteKitVite(config: UserConfig = {}, kit: Config = {}): UserConfig {
  const csp = { mode: "auto" as const, ...kit.csp, directives: { ...directives, ...kit.csp?.directives } };

  return defineConfig({
    ...config,
    plugins: [sveltekit({ ...kit, adapter: kit.adapter ?? adapter(), csp }), ...(config.plugins ?? [])],
  });
}
