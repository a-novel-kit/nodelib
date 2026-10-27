# @a-novel-kit/nodelib-server

Framework-independent runtime primitives for server-rendered A-Novel platforms.

## Installation

Configure the `@a-novel-kit` registry as the
[nodelib README](https://github.com/a-novel-kit/nodelib#installation) shows, then add the package:

```bash
pnpm add @a-novel-kit/nodelib-server
```

## Runtime configuration

The environment schema maps private variable names into a typed application config. A validation
error names the invalid variables and never carries their values.

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

`aggregateHealth` resolves the configuration itself. When resolution fails, every service named by
`config` reports down, with no exception string or invented dependency map. A service whose request
fails, or whose answer breaks the health contract, reports down the same way. Valid dependency maps
pass through unchanged.

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

A downtime runs from its `start` until operators clear it, even past its `end`. The `end` only tells
users when to expect the service back. Call `isDowntimeStarted` instead of comparing dates, so no
page reopens a feature early. In the browser, `isDowntimeError` from
`@a-novel-kit/nodelib-browser/http` tells a refusal during a started downtime from an outage.

## Tracing

`@a-novel-kit/nodelib-server/telemetry` traces a SvelteKit server and carries each trace into the
services it calls. It mirrors golib's OTLP preset, so a platform reads the same variables as the Go
services:

| `enabled` (`OTEL`) | `OTEL_EXPORTER_OTLP_ENDPOINT` | Spans                      |
| ------------------ | ----------------------------- | -------------------------- |
| `false`            | any                           | not recorded               |
| `true`             | unset                         | printed to standard output |
| `true`             | set                           | exported over OTLP/HTTP    |

The OpenTelemetry SDK reads the standard `OTEL_EXPORTER_OTLP_*` variables itself:
`OTEL_EXPORTER_OTLP_HEADERS` carries the backend's key, and `OTEL_EXPORTER_OTLP_COMPRESSION=gzip`
compresses each export. `serviceName` names the platform on every span, and the standard
`OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` label the spans as they do the Go services'.

A platform sets up tracing in three steps:

1. Install the OpenTelemetry peers.
2. Turn on SvelteKit's server spans with `sveltekit({ tracing: { server: true } })`.
3. Start tracing from `src/instrumentation.server.ts`. SvelteKit loads that file before the
   application:

   ```ts
   import { OTEL } from "$app/env/private";

   import { startTelemetry } from "@a-novel-kit/nodelib-server/telemetry";

   const telemetry = startTelemetry({ serviceName: "platform-studio", enabled: OTEL, untracedRoutes: ["/ping"] });

   // adapter-node emits this once the server has closed, so the buffered spans leave before the exit.
   process.on("sveltekit:shutdown", () => void telemetry.shutdown());
   ```

SvelteKit continues the trace named by an incoming `traceparent` header. A global `fetch` made while
handling a request gets a client span and sends the trace context on, so the called service's spans
join the same trace. Every trace is kept, even one the caller did not sample, as in the Go services.
The requests to `untracedRoutes`, matched on the route ID SvelteKit records as `http.route`, produce
no span, so a liveness probe spends no span quota. Recorded URLs keep their parameter names, but each
query value becomes `REDACTED`, since links carry short codes and emails.
