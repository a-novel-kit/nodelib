# @a-novel-kit/nodelib-browser

Browser helpers that handle `fetch` responses, shared async behavior, device preferences and consented
telemetry one way everywhere.

## Installation

Configure the `@a-novel-kit` registry as the
[nodelib README](https://github.com/a-novel-kit/nodelib#installation) shows, then add the package
with its Zod peer:

```bash
pnpm add @a-novel-kit/nodelib-browser zod
```

## Usage

The package is named after the browser, but most of it runs on both sides: a platform's
`+page.server.ts` calls the same service clients and preference parsers its pages do.

`@a-novel-kit/nodelib-browser/http` holds `RestClient`, the base of every service's JS client. Each
client extends it under its own name and adds the `ping` and `health` methods of its API version.
A request takes `accessToken`, sent as a bearer token, and `json`, sent as the body with its
`Content-Type`:

```ts
import { type HealthDependency, RestClient } from "@a-novel-kit/nodelib-browser/http";

export class ProfileApi extends RestClient {
  async ping(): Promise<void> {
    await this.fetchVoid("/v1/ping");
  }

  async health(): Promise<Record<string, HealthDependency>> {
    return await this.fetch("/v1/healthcheck");
  }
}

export async function profileUsernameUpdate(api: ProfileApi, accessToken: string, request: { username: string }) {
  return await api.fetch("/v1/profile", ProfileSchema, { method: "PUT", accessToken, json: request });
}
```

A server-side caller passes a `fetcher` to the constructor, which wraps `fetch` with the headers its
deployment needs, such as its service token: `new ProfileApi(url, serviceFetch(identity))`. Every
method but `fetchResponse` throws an `HttpError` on a non-2xx status. `isHttpStatusError` and
`isDowntimeError` sort a caught error by status, or by a refusal during a planned downtime. They match
an `HttpError` by its name, so prefer them to `instanceof HttpError`: they also accept an error from
another copy of this package, should a bundler ever load two. SvelteKit
exports an `HttpError` and an `isHttpError` of its own, for the errors a server sends; a file that
imports both aliases this package's as `isServiceError`.

`@a-novel-kit/nodelib-browser/utils` holds `retryWithBackoff`, which repeats a failed read until its
owner stops it, and `wait`, an abortable timer that leaves nothing behind.

`@a-novel-kit/nodelib-browser/telemetry` reports a platform's browser errors, page views, Web Vitals
and requests to Grafana Faro once the visitor accepts. It needs the optional Faro peers:

```bash
pnpm add @grafana/faro-web-sdk @grafana/faro-web-tracing
```

The SDK downloads only after the visitor accepts, and the choice stays in a cookie for six months.
With `consentDomain`, the cookie covers every host under that domain, so one answer serves every app
there. A server reads the cookie named `TELEMETRY_CONSENT_COOKIE` with `parseTelemetryChoice`, so the
page renders the answer before it runs in the browser.
A Faro session lasts one visit and is never kept on the device. Same-origin requests carry a W3C
`traceparent`, so each trace continues through the platform's server. Query values, fragments, user
details and console messages never leave the browser.

```ts
import { BrowserTelemetry } from "@a-novel-kit/nodelib-browser/telemetry";

export const telemetry = new BrowserTelemetry({
  url: env.PUBLIC_FARO_URL,
  name: "platform-studio",
  version,
  consentDomain: env.PUBLIC_PLATFORM_DOMAIN,
});

// hooks.client.ts
export const init: ClientInit = () => void telemetry.start();
export const handleError: HandleClientError = ({ kind, error }) => {
  if (kind === "unknown") telemetry.captureError(error);
};

// The root layout names views after routes, and shows the banner while `telemetry.choice` is undefined.
afterNavigate(() => telemetry.arrive(page.route.id));
```

`@a-novel-kit/nodelib-browser/preferences` keeps the settings a visitor leaves on a device, such as a
collapsed navigation rail, in cookies. A server reads `NAVIGATION_RAIL_COOKIE` with
`parseNavigationRail`, so the page renders the rail the visitor left. With `domain`, every app under
that domain shares it. `savePreference` keeps any other setting the same way, for a year:

```ts
import { saveNavigationRail, savePreference } from "@a-novel-kit/nodelib-browser/preferences";

saveNavigationRail("collapsed", { domain: env.PUBLIC_PLATFORM_DOMAIN });
savePreference("project-sort", "title-asc");
```
