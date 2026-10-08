# @a-novel-kit/nodelib-config

Shared tool configuration for a-novel TypeScript packages and SvelteKit applications.

## Installation

Install the config package with the peer tools used by your project. Platform applications normally
install the SvelteKit, Vitest, Storybook, and i18next peers; other packages can continue to use the
root ESLint and Prettier entrypoint.

```bash
pnpm add --save-dev @a-novel-kit/nodelib-config
```

## Entry points

| Import                                         | Role                                                    |
| ---------------------------------------------- | ------------------------------------------------------- |
| `@a-novel-kit/nodelib-config`                  | ESLint and Prettier factories                           |
| `@a-novel-kit/nodelib-config/i18next`          | Static JSON or YAML extraction, status, and type policy |
| `@a-novel-kit/nodelib-config/sveltekit`        | Vite config with SvelteKit and the Node adapter         |
| `@a-novel-kit/nodelib-config/vitest-sveltekit` | Unit, browser-component, and Storybook test projects    |
| `@a-novel-kit/nodelib-config/yaml`             | Build-time JSON-compatible YAML modules for Vite        |

Each framework entrypoint accepts product-specific paths or policy while preserving the shared defaults.

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

Source formats that need an extra Vite transformer can supply a factory to the Vitest matrix. The factory
is called separately for unit, browser-component, and Storybook projects so plugins never share mutable
project state.

```ts
import { SvelteKitVitest } from "@a-novel-kit/nodelib-config/vitest-sveltekit";
import { Yaml } from "@a-novel-kit/nodelib-config/yaml";

export default SvelteKitVitest({
  rootUrl: import.meta.url,
  vitePlugins: () => [Yaml()],
});
```
