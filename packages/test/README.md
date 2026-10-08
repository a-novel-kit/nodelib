# Node lib (tests)

## Installation

> ⚠️ **Warning**: Even though the package is public, GitHub registry requires you to have a Personal Access Token
> with `repo` and `read:packages` scopes to pull it in your project. See
> [this issue](https://github.com/orgs/community/discussions/23386#discussioncomment-3240193) for more information.

Create a `.npmrc` file in the root of your project if it doesn't exist, and make sure it contains the following:

```ini
@a-novel:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${YOUR_PERSONAL_ACCESS_TOKEN}
```

Then, install the package using pnpm:

```bash
# pnpm config set auto-install-peers true
#  Or
# pnpm config set auto-install-peers true --location project
pnpm add @a-novel-kit/nodelib-test
```

## Platform end-to-end helpers

`@a-novel-kit/nodelib-test/playwright` holds the test side of the contract between a platform's
Playwright suite and the shared `test-playwright` action, and pairs with
`@a-novel-kit/nodelib-config/playwright`. It needs the optional `playwright` and `jsdom` peers.

| Export          | Role                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------- |
| `screenshot`    | Visual checkpoint, compared and annotated in CI and attached locally. Keep its name fixed.   |
| `createCompose` | Compose runner for one file; `E2E_CONTAINER_ENGINE` picks the engine (default `docker`).     |
| `composeSetup`  | Global setup that starts the services, waits for readiness, and logs them on teardown.       |
| `emailLink`     | The link a Mailpit-delivered email carries to a path, rejected if it leaves the application. |

```ts
import { composeSetup, createCompose } from "@a-novel-kit/nodelib-test/playwright";

export const compose = createCompose();

export default composeSetup({
  compose,
  ready: async () => (await fetch("http://127.0.0.1:14100/v2/ping")).ok,
});
```
