# @a-novel-kit/nodelib-server

Framework-independent runtime primitives for server-rendered a-novel platforms.

## Installation

GitHub Packages requires a token with `read:packages` even for public packages. Configure the
`@a-novel-kit` registry, then install the package:

```bash
pnpm add @a-novel-kit/nodelib-server
```

## Runtime configuration

The environment schema maps private variable names into a typed application config. Validation
errors contain field names only.

```ts
import { environmentHttpUrl, environmentInteger, parseEnvironment } from "@a-novel-kit/nodelib-server";

function getConfig() {
  return parseEnvironment(process.env, {
    serviceUrl: environmentHttpUrl("SERVICE_URL"),
    timeoutMs: environmentInteger("HEALTHCHECK_TIMEOUT_MS", {
      defaultValue: 2_000,
      minimum: 100,
      maximum: 10_000,
    }),
  });
}
```

## Health aggregation

Declare stable service names and resolve private configuration inside each registry entry. A service
is up when its endpoint is reachable and contract-valid. The aggregate is up when every proxied
dependency also reports up.

```ts
import { aggregateHealth } from "@a-novel-kit/nodelib-server";

const health = await aggregateHealth({
  config: {
    authentication: () => {
      const config = getConfig();

      return {
        timeoutMs: config.timeoutMs,
        url: new URL("healthcheck", `${config.serviceUrl}/`),
      };
    },
  },
  fetch,
});
```

Configuration resolution happens inside `aggregateHealth`. When it fails, every service named by
`config` is returned as down without an exception string or fabricated dependency map. Failed
requests use the same non-disclosing service-down response. Valid dependency maps pass through
unchanged.

Already-validated callers can instead provide an eager `services` registry and shared `timeoutMs`.
