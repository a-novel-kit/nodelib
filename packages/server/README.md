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

const config = parseEnvironment(process.env, {
  serviceUrl: environmentHttpUrl("SERVICE_URL"),
  timeoutMs: environmentInteger("HEALTHCHECK_TIMEOUT_MS", {
    defaultValue: 2_000,
    minimum: 100,
    maximum: 10_000,
  }),
});
```

## Health aggregation

Register complete health endpoint URLs and pass the framework fetch implementation. A service is up
when its endpoint is reachable and contract-valid. The aggregate is up when every proxied dependency
also reports up.

```ts
import { aggregateHealth } from "@a-novel-kit/nodelib-server";

const health = await aggregateHealth({
  fetch,
  services: {
    authentication: { url: new URL("healthcheck", `${config.serviceUrl}/`) },
  },
  timeoutMs: config.timeoutMs,
});
```

Valid dependency maps pass through unchanged. Failed requests return a down service entry without an
exception string or fabricated dependencies.
