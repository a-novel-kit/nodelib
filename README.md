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

`nodelib` collects the cross-cutting glue that the A-Novel frontends and JS/TS tooling would otherwise copy from one repo to the next — the JS/TS analogue of [`golib`](https://github.com/a-novel-kit/golib). It is a pnpm workspace that publishes a handful of focused, independently installable packages under the `@a-novel-kit/` scope, kept deliberately small.

## Installation

The packages are published to GitHub Packages, which requires a Personal Access Token with `read:packages` scope even though the packages are public ([details](https://github.com/orgs/community/discussions/23386#discussioncomment-3240193)). Add an `.npmrc` at your project root:

```ini
@a-novel-kit:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${YOUR_PERSONAL_ACCESS_TOKEN}
```

Then install the package(s) you need (each is published independently):

```bash
pnpm add @a-novel-kit/nodelib-browser
pnpm add -D @a-novel-kit/nodelib-config
pnpm add -D @a-novel-kit/nodelib-test
```

## Packages

| Package                        | What it provides                                                                                                                           | Install                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `@a-novel-kit/nodelib-browser` | Browser runtime helpers: typed HTTP error handling and Zod-backed response decoding, plus small utilities (debounce, retry).               | `pnpm add @a-novel-kit/nodelib-browser`   |
| `@a-novel-kit/nodelib-config`  | Shared dev-tooling config: factories for the flat ESLint and Prettier configs (TypeScript, with optional Svelte / Storybook / SQL layers). | `pnpm add -D @a-novel-kit/nodelib-config` |
| `@a-novel-kit/nodelib-test`    | Test toolkit: a fluent MSW request-matcher builder, HTTP/form assertions, and ready-made mocks (Tolgee, query client).                     | `pnpm add -D @a-novel-kit/nodelib-test`   |

## Contributing

Platform setup and the day-to-day commands live in the [developer onboarding guide](https://github.com/a-novel-kit/.github/blob/master/README.md); `nodelib`-specific notes are in [CONTRIBUTING.md](./CONTRIBUTING.md).
