# Node lib

The shared Node.js/TypeScript packages the A-Novel frontends and tooling reuse — HTTP/utility helpers, the common ESLint + Prettier config, and the test toolkit.

[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/agorastoryverse)](https://twitter.com/agorastoryverse)
[![Discord](https://img.shields.io/discord/1315240114691248138?logo=discord)](https://discord.gg/rp4Qr8cA)

<hr />

![GitHub repo file or directory count](https://img.shields.io/github/directory-file-count/a-novel-kit/nodelib)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/a-novel-kit/nodelib)

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/a-novel-kit/nodelib/main.yaml)
[![codecov](https://codecov.io/gh/a-novel-kit/nodelib/graph/badge.svg)](https://codecov.io/gh/a-novel-kit/nodelib)

![Coverage graph](https://codecov.io/gh/a-novel-kit/nodelib/graphs/sunburst.svg)

## What this is

`nodelib` collects the small amount of cross-cutting glue that the A-Novel frontends and JS/TS tooling would otherwise copy from one repo to the next — fetch/HTTP error handling, browser utilities, the shared ESLint and Prettier configuration, and a test toolkit. It is the JS/TS analogue of [`golib`](https://github.com/a-novel-kit/golib): a pnpm workspace that publishes a handful of focused, independently installable packages under the `@a-novel-kit/` scope on GitHub Packages. It is deliberately kept minimal — anything a well-maintained dependency already covers belongs in that dependency, not here.

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

| Package                        | What it provides                                                                                                                                                                                                                                                       | Install                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `@a-novel-kit/nodelib-browser` | Browser runtime helpers. `./http`: the `HttpError` class and `newHttpError` / `isHttpError` / `isHttpStatusError` guards, `handleHttpResponse`, Zod-backed `decodeHttpResponse`, and `HTTP_HEADERS`. `./utils`: a `Debounce` class and a configurable `retry` wrapper. | `pnpm add @a-novel-kit/nodelib-browser`   |
| `@a-novel-kit/nodelib-config`  | The shared dev-tooling config. `Eslint(opts)` builds the flat ESLint config (TypeScript plus optional Svelte / Storybook layers) and `Prettier(opts)` builds the Prettier config (with optional Svelte / SQL plugins and the standard import-order rules).             | `pnpm add -D @a-novel-kit/nodelib-config` |
| `@a-novel-kit/nodelib-test`    | The test toolkit. `./msw`: a fluent MSW request-matcher builder (body / headers / path & search params). `./http`: `expectStatus`. `./form`: the `writeField` Testing-Library helper. `./mocks/tolgee` and `./mocks/query_client`: ready-made mocks.                   | `pnpm add -D @a-novel-kit/nodelib-test`   |

## Contributing

Platform setup and the day-to-day commands live in the [developer onboarding guide](https://github.com/a-novel-kit/.github/blob/master/README.md); `nodelib`-specific notes are in [CONTRIBUTING.md](./CONTRIBUTING.md). The bar for additions is deliberately high — convenience wrappers around well-maintained dependencies, and one-off helpers only one project needs, do not belong here.
