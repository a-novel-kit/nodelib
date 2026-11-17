# Upgrading to NEXT

nodelib takes in the code every service client and every platform copies: a `RestClient` base, the
Svelte helpers, and the platform server's workarounds. It also drops the exports no repository uses.

## Do I need to act?

**Required** only for a project that imports a removed export, which no repository of either
organization does, and for a service client built on `RestClient`, which raises its peer on
nodelib-browser to this release. **Recommended** for every
service JS client and every platform: each section names the local copies the release replaces.

## Replace the removed exports

These exports had no consumer, and are gone:

| Package             | Removed                                                                                                        | Use instead                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `browser/utils`     | `Debounce`, `retry`, `RetryParams`, `RetryFailureFn`                                                           | `retryWithBackoff`, or `retryWhile` in a component |
| `browser/http`      | `newHttpError`                                                                                                 | `handleHttpResponse`, which throws the `HttpError` |
| `browser/telemetry` | `readTelemetryChoice`, `saveTelemetryChoice`, `SaveTelemetryChoiceOptions`                                     | `BrowserTelemetry`'s `choice` and `choose`         |
| `i18n`              | `createRequestI18n`, `NamespaceLoader`, `RequestI18nOptions`                                                   | `createStaticI18n` with bundled catalogs           |
| `server`            | `aggregateHealth({ services, timeoutMs })`, `HealthService`, `HealthServiceRegistry`, `AggregateHealthOptions` | `aggregateHealth({ config, fetch })`               |

`pnpm lint:typecheck` names any import left behind.

## Build a service client on `RestClient`

A service's `pkg/js/rest/src/api.ts` extends `RestClient` from `@a-novel-kit/nodelib-browser/http`
and keeps only its `ping` and `health`. The constructor takes the optional `fetcher` every client
now shares, so a platform drops its header-injecting subclass. `fetchVoid` releases the body it
discards.

```diff
-export class ProfileApi {
-  private readonly _baseUrl: string;
-  constructor(baseUrl: string) { … }
-  async fetchVoid(…) { … }
-  async fetch<T>(…) { … }
-  async fetchBlob(…) { … }
+import { type HealthDependency, RestClient } from "@a-novel-kit/nodelib-browser/http";
+
+export class ProfileApi extends RestClient {
   async ping(): Promise<void> { … }
   async health(): Promise<Record<string, HealthDependency>> { … }
 }
```

A request passes `accessToken` and `json` instead of building its headers and body. A request
without a body sends no `Content-Type`:

```diff
 return await api.fetch("/v1/profile", ProfileSchema, {
   method: "PUT",
-  headers: { ...HTTP_HEADERS.JSON, Authorization: `Bearer ${accessToken}` },
-  body: JSON.stringify(request),
+  accessToken,
+  json: request,
 });
```

The client's `pkg/js/rest/package.json` raises its `@a-novel-kit/nodelib-browser` peer from
`^1.3.18 || ^2.0.0` to this release: an older nodelib-browser has no `RestClient`, and the client
would fail at import.

`HTTP_HEADERS` is deprecated, and leaves in a later release once no client uses it. A plain `fetch`,
such as platform-studio's `src/lib/client/projects/api.ts` calling Studio's own routes, sets
`{ "Content-Type": "application/json" }` beside its body instead. The service's
own `HealthDependency` export can re-export the package's. The narrative engine's `stream` sends
through `this.fetchResponse`, and imports `wait` from `@a-novel-kit/nodelib-browser/utils`, which
leaves no abort listener behind.

## Import the Svelte helpers from `nodelib-browser/svelte`

A platform deletes `src/lib/client/retry.svelte.ts` and its test, `src/lib/ui/downtime.svelte.ts`,
`src/lib/client/telemetry-preference.svelte.ts` and `src/lib/ui/telemetry-preference.ts`, and
imports the same names from `@a-novel-kit/nodelib-browser/svelte`. `retryWhile` reports a bounded
run's failure to `onError` instead of the platform's telemetry module:

```diff
-import { retryWhile } from "#lib/client/retry.svelte.js";
+import { retryWhile } from "@a-novel-kit/nodelib-browser/svelte";

 const listRetries = retryWhile(missing, attempt, {
   maxRetries: 3,
+  onError: (error) => telemetry.captureError(error),
 });
```

The entry ships its modules with their runes for the application's Svelte compiler, so the
project needs `svelte` 5.57.3 or later, which every platform has.

The entry also makes nodelib-browser a Svelte package, which a SvelteKit server build inlines, while
each service client keeps loading its own copy from `node_modules`. An `HttpError` therefore matches
by its name: `instanceof HttpError`, `isHttpError` and `isHttpStatusError` accept one from either
copy, so no check changes.

## Simplify the platform server

- **Runtime config.** `environmentHttpUrl(name, { defaultValue })` and `environmentOptional(name)`
  replace the `DOWNTIME_URL ?? default` and `*_TOKEN_PATH || undefined` workarounds, so `RuntimeConfig`
  becomes `EnvironmentOutput<typeof schema>`. An optional field is a required key typed
  `string | undefined`, so a test fixture of the config sets `serviceTokenPath: undefined`.
- **Health.** Each service's entry in `aggregateHealth`'s `config` takes its own `fetch`. Pass
  `serviceFetch({ serviceTokenPath })` there, and drop the code that maps a probe URL back to a token.
- **Tracing.** `traceResponse` from `@a-novel-kit/nodelib-server/telemetry` replaces the hook's local
  copy.
- **Preferences.** `savePreference(name, value)` replaces a hand-written `document.cookie`, and adds
  `Secure` over HTTPS.
