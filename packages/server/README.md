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
import {
  environmentHttpUrl,
  environmentInteger,
  environmentOptional,
  parseEnvironment,
} from "@a-novel-kit/nodelib-server";

function getConfig() {
  return parseEnvironment(process.env, {
    downtimeUrl: environmentHttpUrl("DOWNTIME_URL", { defaultValue: "https://example.test/downtime.json" }),
    serviceUrl: environmentHttpUrl("SERVICE_URL"),
    serviceTokenPath: environmentOptional("SERVICE_TOKEN_PATH"),
    timeoutMs: environmentInteger("HEALTHCHECK_TIMEOUT_MS", {
      defaultValue: 2_000,
      minimum: 100,
      maximum: 10_000,
    }),
  });
}
```

`EnvironmentOutput<typeof schema>` names the config's type. An optional variable left empty reads as
absent.

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
        // The service requires the platform's token, even on its health endpoint.
        fetch: serviceFetch({ serviceTokenPath: config.serviceTokenPath }, fetch),
      };
    },
  },
  fetch,
});
```

`aggregateHealth` resolves the configuration itself. When resolution fails, every service named by
`config` reports down, with no exception string or invented dependency map. A service whose request
fails, or whose answer breaks the health contract, reports down the same way. Valid dependency maps
pass through unchanged. A service's own `fetch` sends its probe, and the shared `fetch` sends the
others.

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

## Token verification

`createJwtVerifier` verifies a compact JWT against the issuer's public keys, locally, so a server
checks a token without calling the issuer on each request. It accepts Ed25519 signatures (RFC 9864)
whose claims match the options. Create one verifier per process.

```ts
import { createJwtVerifier } from "@a-novel-kit/nodelib-server";

const verifyAccessToken = createJwtVerifier({
  fetchKeys: async () => {
    const response = await fetch(jwksUrl, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) throw new Error(`key set unavailable: HTTP ${response.status}`);
    return (await response.json()).keys;
  },
  issuer: "https://issuer.example",
  audience: "my-platform",
  subject: "user-access",
  leewayMs: 300_000,
  cacheMs: 1_800_000,
  staleIfErrorMs: 86_400_000,
});

const claims = await verifyAccessToken(token);
```

The verifier fetches the key set once per `cacheMs`, and concurrent callers share the fetch. A token
naming a key the set lacks fetches the set again, at most every 10 seconds, so a key the issuer has
just rotated to verifies at once. A failed fetch is retried after 30 seconds, and the last set stays
in use for `staleIfErrorMs` past its cache. Every rejection throws, so a caller with another way to
check a token, such as asking its issuer, can fall back to it.

## API key tokens

An API key is an Ed25519 key pair made for one purpose. Its holder keeps the private key and never
sends it. With it, the holder signs two kinds of token, and anyone with the public key verifies
them.

- **A request token** authenticates one request, which carries it as its bearer token. It lives five
  minutes and names the SHA-256 of the body, so the signature covers the content as well as the
  caller.
- **A proof** vouches for the caller's claims, such as the digests of what the holder published. It
  is stored with what it vouches for and never expires, so a client can check it long after.

```ts
import { createProofSigner, createRequestTokenSigner } from "@a-novel-kit/nodelib-server";

const apiKey = { privateKey: apiKeyPem, purpose: "publish-package" };
const signRequest = createRequestTokenSigner(apiKey);
const signProof = createProofSigner(apiKey);

const body = JSON.stringify({ ...document, proof: signProof({ name, version, archiveSHA256 }) });
await fetch(url, { method: "POST", headers: { authorization: `Bearer ${signRequest(body)}` }, body });
```

Both are JWTs signed with Ed25519, under the `EdDSA` label. `aud` names the purpose and `iat` the
time of signing. A request token adds a life of five minutes (`exp`) and the lowercase hex SHA-256 of
the body (`bodySHA256`). Sign the body exactly as it is sent: a string counts as its UTF-8 bytes, as
`fetch` sends it. A proof's `typ` is `proof+jwt` and a request token's is `JWT`, so neither passes
for the other.

Every token names its key in `kid`, so a verifier can find the public key. A system API key goes by
the JWK thumbprint of its public key (RFC 7638), which a signer derives from the private key, and
`jwkThumbprint` computes from a public key in JWK form. Pass `keyID` for a key listed under another
ID.

A signer reads the key once and refuses anything but an Ed25519 private key in PEM. Its error never
quotes the key. A signer also refuses claims that make a token longer than 8192 characters, which no
verifier here reads.

```ts
import { verifyProof, verifyRequestToken } from "@a-novel-kit/nodelib-server";

const apiKey = { publicKey: jwk, purpose: "publish-package" };
const request = await verifyRequestToken(token, receivedBody, apiKey);
const vouched = await verifyProof(stored.proof, apiKey);
```

The verifiers take the public key as a JWK and resolve to the claims, after the checks of
`createJwtVerifier` on the header and the signature. Each checks the token's `typ` exactly (RFC 8725
§3.11). A proof's age is no failure. A request token must name the digest of the body as received,
and live at most five minutes from its `iat`. Both tolerate 30 seconds of clock skew, and every
rejection throws. Compare a proof's claims with what it vouches for: the verifier checks only who
signed them.

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
2. Turn on SvelteKit's server spans, which `SvelteKitVite` from `@a-novel-kit/nodelib-config/sveltekit`
   does by default.
3. Start tracing from `src/instrumentation.server.ts`. SvelteKit loads that file before the
   application:

   ```ts
   import { OTEL } from "$app/env/private";

   import { startTelemetry } from "@a-novel-kit/nodelib-server/telemetry";

   const telemetry = startTelemetry({ serviceName: "platform-studio", enabled: OTEL, untracedRoutes: ["/ping"] });

   // adapter-node emits this once the server has closed, so the buffered spans leave before the exit.
   process.on("sveltekit:shutdown", () => void telemetry.shutdown());
   ```

SvelteKit continues the trace named by an incoming `traceparent` header. Its span for each request,
`sveltekit.handle.root`, becomes the request's server span, so span metrics still count the request
once the browser's `traceparent` gives that span a parent. A global `fetch` made while
handling a request gets a client span and sends the trace context on, so the called service's spans
join the same trace. Every trace is kept, even one the caller did not sample, as in the Go services.
The requests to `untracedRoutes`, matched on the route ID SvelteKit records as `http.route`, produce
no span, so a liveness probe spends no span quota. Recorded URLs keep their parameter names, but each
query value becomes `REDACTED`, since links carry short codes and emails.

`traceResponse` names the request's span after its route, as `GET /(app)/account`, records the
response's status, and marks a 5xx answer as an error, so span metrics split the traffic by page and
tell a refusal from a fault. Call it from the `handle` hook:

```ts
import { traceResponse } from "@a-novel-kit/nodelib-server/telemetry";

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  traceResponse(event, response);
  return response;
};
```
