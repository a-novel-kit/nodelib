# Node lib

The shared Node.js/TypeScript packages the A-Novel frontends and tooling reuse.

[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/agorastoryverse)](https://twitter.com/agorastoryverse)
[![Discord](https://img.shields.io/discord/1315240114691248138?logo=discord)](https://discord.gg/rp4Qr8cA)

<hr />

![GitHub repo file or directory count](https://img.shields.io/github/directory-file-count/a-novel-kit/nodelib)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/a-novel-kit/nodelib)

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/a-novel-kit/nodelib/main.yaml)
[![codecov](https://codecov.io/gh/a-novel-kit/nodelib/graph/badge.svg)](https://codecov.io/gh/a-novel-kit/nodelib)

![Coverage graph](https://codecov.io/gh/a-novel-kit/nodelib/graphs/sunburst.svg)

## What this is

`nodelib` collects the cross-cutting glue that the A-Novel frontends and JS/TS tooling would otherwise copy from one repo to the next. It is the JS/TS analogue of [`golib`](https://github.com/a-novel-kit/golib). The pnpm workspace publishes focused packages under the `@a-novel-kit/` scope and keeps each one small.

## Installation

The packages are published to GitHub Packages, which requires a Personal Access Token with `read:packages` scope even though the packages are public ([details](https://github.com/orgs/community/discussions/23386#discussioncomment-3240193)). Add an `.npmrc` at your project root:

```ini
@a-novel-kit:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${YOUR_PERSONAL_ACCESS_TOKEN}
```

Then install the package or packages the application needs:

```bash
pnpm add @a-novel-kit/nodelib-browser
pnpm add @a-novel-kit/nodelib-i18n
pnpm add @a-novel-kit/nodelib-server
pnpm add -D @a-novel-kit/nodelib-config
pnpm add -D @a-novel-kit/nodelib-test
```

## Packages

| Package                        | What it is for                                                                                                                                        | Install                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `@a-novel-kit/nodelib-browser` | Runtime helpers that let browser applications handle HTTP responses, retries, and other shared async behavior consistently.                           | `pnpm add @a-novel-kit/nodelib-browser`   |
| `@a-novel-kit/nodelib-config`  | Shared lint, formatting, SvelteKit, Vitest, Storybook, localization, and YAML build configuration without forcing optional tools onto every consumer. | `pnpm add -D @a-novel-kit/nodelib-config` |
| `@a-novel-kit/nodelib-i18n`    | Request-isolated i18next runtime helpers and supported-locale negotiation that leave catalogs and product locale policy with each application.        | `pnpm add @a-novel-kit/nodelib-i18n`      |
| `@a-novel-kit/nodelib-server`  | Server runtime primitives for private environment parsing and bounded downstream health aggregation in platform applications.                         | `pnpm add @a-novel-kit/nodelib-server`    |
| `@a-novel-kit/nodelib-test`    | Testing helpers that keep request mocks and service fixtures consistent across frontend repositories.                                                 | `pnpm add -D @a-novel-kit/nodelib-test`   |

## Contributing

Start with the [developer onboarding guide](https://github.com/a-novel-kit/.github/blob/master/README.md), then read the [nodelib contribution guide](./CONTRIBUTING.md).
