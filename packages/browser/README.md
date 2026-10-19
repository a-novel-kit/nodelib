# @a-novel-kit/nodelib-browser

Browser helpers that handle `fetch` responses and shared async behavior one way everywhere.

## Installation

GitHub Packages needs a token with `read:packages`, even for public packages. Configure the
`@a-novel-kit` registry as the [nodelib README](https://github.com/a-novel-kit/nodelib#installation)
shows, then add the package with its Zod peer:

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
