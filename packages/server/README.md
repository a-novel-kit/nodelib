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

## Planned downtime

Operators publish the planned downtime as a public JSON document: its components, start and end, or
`null` without one. Create one reader per process and call it wherever a page needs the downtime.

```ts
import { createDowntimeReader, isDowntimeStarted } from "@a-novel-kit/nodelib-server";

const readDowntime = createDowntimeReader({ url: getConfig().downtimeUrl });

const downtime = await readDowntime();
if (isDowntimeStarted(downtime) && downtime.components.includes("service-json-keys.database")) {
  // Render the downtime state instead of calling the service.
}
```

The reader reuses a read for a minute by default, and concurrent callers share one request. A failed
or malformed read keeps the last known value, so a network blip neither invents a downtime nor
drops one in progress.

A downtime has started from its `start` until operators clear it, even past its `end`: `end` is only
what users were told. Use `isDowntimeStarted` rather than comparing dates, so no page reopens a
feature early. In the browser, `isDowntimeError` from `@a-novel-kit/nodelib-browser/http` tells a
refusal during a started downtime from an outage.
