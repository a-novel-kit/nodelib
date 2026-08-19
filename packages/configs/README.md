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
| `@a-novel-kit/nodelib-config/sveltekit`        | Adapter-node SvelteKit and Vite defaults                |
| `@a-novel-kit/nodelib-config/vitest-sveltekit` | Unit, browser-component, and Storybook test projects    |
| `@a-novel-kit/nodelib-config/yaml`             | Build-time JSON-compatible YAML modules for Vite        |

Each framework entrypoint accepts product-specific paths or policy while preserving the shared defaults.
