# @a-novel-kit/nodelib-test

Test helpers for service clients and platform end-to-end suites.

## Installation

GitHub Packages needs a token with `read:packages`, even for public packages. Configure the
`@a-novel-kit` registry as the [nodelib README](https://github.com/a-novel-kit/nodelib#installation)
shows, then add the package:

```bash
pnpm add -D @a-novel-kit/nodelib-test
```

## HTTP status assertions

`expectStatus` from `@a-novel-kit/nodelib-test/http` asserts that a client call rejects with a
given HTTP status. It recognizes the `HttpError` that `@a-novel-kit/nodelib-browser/http` throws.

```ts
import { expectStatus } from "@a-novel-kit/nodelib-test/http";

await expectStatus(itemGet(api, "not-a-uuid"), 400);
```

## Platform end-to-end helpers

`@a-novel-kit/nodelib-test/playwright` holds the test side of the contract between a platform's
Playwright suite and the shared `test-playwright` action. It pairs with
`@a-novel-kit/nodelib-config/playwright` and needs the optional `playwright` and `jsdom` peers.

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
