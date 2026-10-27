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

`nodelib` holds the glue the A-Novel frontends and JS/TS tooling share, so no repository copies it from another. It is the JS/TS counterpart of [`golib`](https://github.com/a-novel-kit/golib). The pnpm workspace publishes small, focused packages under the `@a-novel-kit/` scope.

## Installation

The packages live on GitHub Packages. GitHub asks for a Personal Access Token with the `read:packages` scope, even for public packages ([details](https://github.com/orgs/community/discussions/23386#discussioncomment-3240193)). Point the `@a-novel-kit` scope at the registry in an `.npmrc` at your project root:

```ini
@a-novel-kit:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${YOUR_PERSONAL_ACCESS_TOKEN}
```

Then add the packages the application needs:

```bash
pnpm add @a-novel-kit/nodelib-browser
pnpm add @a-novel-kit/nodelib-i18n
pnpm add @a-novel-kit/nodelib-server
pnpm add -D @a-novel-kit/nodelib-config
pnpm add -D @a-novel-kit/nodelib-test
```

## Packages

| Package                                              | What it is for                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [`@a-novel-kit/nodelib-browser`](./packages/browser) | Browser helpers that handle `fetch` responses, shared async behavior and consented telemetry one way everywhere. |
| [`@a-novel-kit/nodelib-config`](./packages/configs)  | The shared lint, format, build and test presets.                                                                 |
| [`@a-novel-kit/nodelib-i18n`](./packages/i18n)       | Isolated i18next instances and locale negotiation. Catalogs stay with each app.                                  |
| [`@a-novel-kit/nodelib-server`](./packages/server)   | Framework-independent runtime primitives for platform servers.                                                   |
| [`@a-novel-kit/nodelib-test`](./packages/test)       | HTTP status assertions and the helpers of platform end-to-end suites.                                            |

## Contributing

Start with the [developer guide](https://a-novel-kit.github.io/stack/), then read the [nodelib contribution guide](./CONTRIBUTING.md).
