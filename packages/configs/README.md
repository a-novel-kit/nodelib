# @a-novel-kit/nodelib-config

Shared tool configuration for A-Novel TypeScript packages and SvelteKit applications.

## Installation

Configure the `@a-novel-kit` registry as the
[nodelib README](https://github.com/a-novel-kit/nodelib#installation) shows, then add the package:

```bash
pnpm add --save-dev @a-novel-kit/nodelib-config
```

The root entry point needs the ESLint and Prettier peers. The other entry points add optional peers,
which only a project importing them installs.

## Entry points

| Import                                         | Role                                                    | Optional peers                                                                             |
| ---------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `@a-novel-kit/nodelib-config`                  | ESLint and Prettier factories                           | `prettier-plugin-svelte` and `prettier-plugin-css-order` for Svelte, `prettier-plugin-sql` |
| `@a-novel-kit/nodelib-config/eslint-svelte`    | ESLint config with the Svelte and Storybook rules       | `eslint-plugin-svelte`, `eslint-plugin-storybook`                                          |
| `@a-novel-kit/nodelib-config/faro`             | Release-build source-map upload to Grafana Faro         | `vite`                                                                                     |
| `@a-novel-kit/nodelib-config/i18next`          | Static JSON or YAML extraction, status, and type policy | `i18next-cli`, `i18next-cli-plugin-svelte`                                                 |
| `@a-novel-kit/nodelib-config/playwright`       | End-to-end suite of a platform's production build       | `playwright`                                                                               |
| `@a-novel-kit/nodelib-config/sveltekit`        | Vite config with SvelteKit and the Node adapter         | `vite`, `@sveltejs/kit`, `@sveltejs/adapter-node`                                          |
| `@a-novel-kit/nodelib-config/vitest-offline`   | Vitest setup file that rejects every unstubbed `fetch`  | None                                                                                       |
| `@a-novel-kit/nodelib-config/vitest-sveltekit` | Unit, browser-component, and Storybook test projects    | `vitest`, `@vitest/browser-playwright`, `@storybook/addon-vitest`, `@sveltejs/kit`         |
| `@a-novel-kit/nodelib-config/yaml`             | Build-time JSON-compatible YAML modules for Vite        | `vite`                                                                                     |

Each framework entry point accepts product-specific paths or policy and keeps the shared defaults.

`SvelteKitVite` gives every page a Content Security Policy: `script-src 'self'` with SvelteKit's
nonce or hash for its own inline scripts, `object-src 'none'`, `base-uri 'none'` and
`frame-ancestors 'none'`. Each directive in `kit.csp.directives` adds to that policy or replaces the
default of the same name. `form-action` stays open, since a sign-in form redirects to an origin each
deployment configures at runtime. The platform sends it from its server hook, where a second policy
narrows the first:

```ts
response.headers.append("content-security-policy", `form-action 'self' ${accountOrigin}`);
```

The Vitest matrix runs unit tests offline through `vitest-offline`: the global `fetch` rejects every
request a test does not stub. A test answers its requests with `vi.stubGlobal("fetch", …)`.

Source formats that need an extra Vite transformer supply a plugin factory to the Vitest matrix. The
matrix calls it once per project, so the unit, browser-component and Storybook projects never share
mutable plugin state.

```ts
import { SvelteKitVitest } from "@a-novel-kit/nodelib-config/vitest-sveltekit";
import { Yaml } from "@a-novel-kit/nodelib-config/yaml";

export default SvelteKitVitest({
  rootUrl: import.meta.url,
  vitePlugins: () => [Yaml()],
});
```

A release build sends the browser's source maps to the platform's Grafana Faro app, then deletes them,
so the image ships none. The plugin acts only when the build holds `FARO_SOURCEMAP_API_KEY` and
`FARO_SOURCEMAP_APP_ID`, and a refused upload fails the build:

```ts
import { FaroSourceMaps } from "@a-novel-kit/nodelib-config/faro";

const faro = {
  appName: "platform-studio",
  endpoint: "https://faro-api-prod-eu-west-2.grafana.net/faro",
  stackId: 1896612,
};

export default SvelteKitVite({ plugins: [Yaml(), FaroSourceMaps(faro)] });
```

## Commands

`nodelib-i18n-changes` reports the translation changes a branch makes since its merge base with
`--base` (default `origin/master`). It reads every locale's JSON or YAML catalogs under `--catalogs`
(default `src/lib/i18n/locales`, the `I18next()` preset's location) and exits non-zero on a finding.

| Check   | Reports                                                                              |
| ------- | ------------------------------------------------------------------------------------ |
| `gaps`  | Translations the branch left empty. Gaps already at the merge base are not repeated. |
| `drift` | Source messages the branch changed while their translations kept their values.       |

```bash
nodelib-i18n-changes gaps --source en
nodelib-i18n-changes drift --source en --base origin/master
```

The base branch must be fetched, as in a CI checkout with `fetch-depth: 0`.
