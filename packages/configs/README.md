# @a-novel-kit/nodelib-config

Shared tool configuration for a-novel TypeScript packages and SvelteKit applications.

## Installation

Install the config package with the peer tools used by your project. Platform applications normally
install the SvelteKit, Vitest, Storybook, and i18next peers; non-Svelte packages can continue to use
the root ESLint and Prettier entrypoint without loading those optional tools.

```bash
pnpm add --save-dev @a-novel-kit/nodelib-config
```

## Entry points

| Import                                         | Role                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| `@a-novel-kit/nodelib-config`                  | ESLint and Prettier factories                             |
| `@a-novel-kit/nodelib-config/i18next`          | Static JSON extraction, status, and generated-type policy |
| `@a-novel-kit/nodelib-config/sveltekit`        | Adapter-node SvelteKit and Vite defaults                  |
| `@a-novel-kit/nodelib-config/vitest-sveltekit` | Unit, browser-component, and Storybook test projects      |

Each framework entrypoint accepts product-specific paths or policy while preserving the shared defaults.
