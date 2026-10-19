# @a-novel-kit/nodelib-config

Shared tool configuration for A-Novel TypeScript packages and SvelteKit applications.

## Installation

Install the config package with the peer tools your project uses. The root entry point needs the
ESLint and Prettier peers. Each framework entry point adds optional peers, which platform
applications install: SvelteKit, Vitest, Storybook and i18next.

```bash
pnpm add --save-dev @a-novel-kit/nodelib-config
```

## Entry points

| Import                                         | Role                                                    |
| ---------------------------------------------- | ------------------------------------------------------- |
| `@a-novel-kit/nodelib-config`                  | ESLint and Prettier factories                           |
| `@a-novel-kit/nodelib-config/i18next`          | Static JSON or YAML extraction, status, and type policy |
| `@a-novel-kit/nodelib-config/playwright`       | End-to-end suite of a platform's production build       |
| `@a-novel-kit/nodelib-config/sveltekit`        | Vite config with SvelteKit and the Node adapter         |
| `@a-novel-kit/nodelib-config/vitest-sveltekit` | Unit, browser-component, and Storybook test projects    |
| `@a-novel-kit/nodelib-config/yaml`             | Build-time JSON-compatible YAML modules for Vite        |

Each framework entrypoint accepts product-specific paths or policy and keeps the shared defaults.

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
