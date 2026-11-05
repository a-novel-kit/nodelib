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

`@a-novel-kit/nodelib-browser/http` turns a failed response into an `HttpError` and validates a JSON
body against a Zod schema:

```ts
import { decodeHttpResponse, handleHttpResponse } from "@a-novel-kit/nodelib-browser/http";

import { z } from "zod";

const UserSchema = z.object({ id: z.string() });

const user = await fetch("/api/user").then(handleHttpResponse).then(decodeHttpResponse(UserSchema));
```

`isHttpStatusError` and `isDowntimeError` sort a caught error by status, or by a refusal during a
planned downtime. `@a-novel-kit/nodelib-browser/utils` holds the `Debounce` helper and the deprecated
`retry`.

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
that domain shares it:

```ts
import { saveNavigationRail } from "@a-novel-kit/nodelib-browser/preferences";

saveNavigationRail("collapsed", { domain: env.PUBLIC_PLATFORM_DOMAIN });
```
