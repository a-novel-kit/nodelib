# @a-novel-kit/nodelib-browser

Browser helpers that handle `fetch` responses, shared async behavior and consented telemetry one way
everywhere.

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
planned downtime. `@a-novel-kit/nodelib-browser/utils` holds the `Debounce` and `retry` helpers.

`@a-novel-kit/nodelib-browser/telemetry` reports a platform's browser errors, page loads, navigations
and Web Vitals to Sentry once the visitor accepts. It needs the optional `@sentry/browser` peer:

```bash
pnpm add @sentry/browser
```

The SDK downloads only after the visitor accepts, and the choice stays on the device for six months.
Same-origin requests carry a W3C `traceparent`, so each trace continues through the platform's
server. Query values, cookies, headers, sessions and console messages never leave the browser.

```ts
import { BrowserTelemetry } from "@a-novel-kit/nodelib-browser/telemetry";

export const telemetry = new BrowserTelemetry({ dsn: env.PUBLIC_SENTRY_DSN, release: "platform-studio@1.2.3" });

// hooks.client.ts
export const init: ClientInit = () => void telemetry.start();
export const handleError: HandleClientError = ({ kind, error }) => {
  if (kind === "unknown") telemetry.captureError(error);
};

// The root layout names spans after routes, and shows the banner while `telemetry.choice` is undefined.
beforeNavigate((navigation) => telemetry.navigate(navigation));
afterNavigate(() => telemetry.arrive(page.route.id));
```
