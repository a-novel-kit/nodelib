# @a-novel-kit/nodelib-test

Test helpers for service clients and platform end-to-end suites.

## Installation

Configure the `@a-novel-kit` registry as the
[nodelib README](https://github.com/a-novel-kit/nodelib#installation) shows, then add the package:

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

## Mailpit

`@a-novel-kit/nodelib-test/mailpit` reads the emails a test sends to Mailpit, with no test runner of
its own, so a Playwright journey and a Vitest integration suite poll it the same way. `searchMail`
reads the messages a search matches once; `mailLinks` lists an HTML body's links, entities decoded.
It needs the optional `jsdom` peer.

```ts
import { mailLinks, searchMail } from "@a-novel-kit/nodelib-test/mailpit";

const invitation = await vi.waitFor(async () => {
  const [message] = await searchMail(process.env.MAIL_UI_URL!, `to:"${email}"`);
  if (!message) throw new Error(`No email to ${email} yet`);
  return message;
});
const link = mailLinks(invitation.HTML).find((href) => new URL(href).pathname === "/ext/account/create");
```

## Platform end-to-end helpers

`@a-novel-kit/nodelib-test/playwright` holds the test side of the contract between a platform's
Playwright suite and the shared `test-playwright` action. It pairs with
`@a-novel-kit/nodelib-config/playwright` and needs the optional `playwright` and `jsdom` peers.

| Export                                               | Role                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `screenshot`                                         | Visual checkpoint, compared and annotated in CI and attached locally. Keep its name fixed.              |
| `createCompose`                                      | Compose runner for one file; `E2E_CONTAINER_ENGINE` picks the engine (default `docker`).                |
| `composeSetup`                                       | Global setup that starts the services, waits for readiness, and logs them on teardown.                  |
| `emailLink`                                          | The link a Mailpit-delivered email carries to a path, rejected if it leaves the application.            |
| `downtimeServers`, `downtimeOrigin`, `downtimeSetup` | One platform server per planned downtime state, and the documents they read.                            |
| `serviceToken`, `callerFetch`, `serviceTokenSetup`   | Service tokens from the stack's local issuer, for the servers under test and for a journey's own calls. |

```ts
import { composeSetup, createCompose } from "@a-novel-kit/nodelib-test/playwright";

export const compose = createCompose();

export default composeSetup({
  compose,
  ready: async () => (await fetch("http://127.0.0.1:14100/v2/ping")).ok,
});
```

A platform runs one server of its build per downtime state, each reading its own published document.
The first, without a downtime, serves the suite's base URL; a journey reaches another through
`downtimeOrigin(state)`:

```ts
// playwright.config.ts
import { SvelteKitPlaywright } from "@a-novel-kit/nodelib-config/playwright";
import { downtimeServers } from "@a-novel-kit/nodelib-test/playwright";

export default defineConfig({
  ...SvelteKitPlaywright({ servers: downtimeServers(), serverEnvironment: { SERVICE_TOKEN_PATH: serviceTokenPath } }),
  globalSetup: ["./tests/e2e/setup.ts", "./tests/e2e/service-token.ts", "./tests/e2e/downtime.ts"],
});

// tests/e2e/downtime.ts
export default downtimeSetup();

// tests/e2e/service-token.ts
export default serviceTokenSetup([{ path: serviceTokenPath, subject: "system:serviceaccount:studio:web" }]);
```
