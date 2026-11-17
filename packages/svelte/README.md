# @a-novel-kit/nodelib-svelte

Svelte 5 helpers every A-Novel platform shares.

## Installation

Configure the `@a-novel-kit` registry as the
[nodelib README](https://github.com/a-novel-kit/nodelib#installation) shows, then add the package
beside its `nodelib-browser` and `svelte` peers:

```bash
pnpm add @a-novel-kit/nodelib-svelte @a-novel-kit/nodelib-browser svelte
```

## Usage

The modules ship with their runes, which the application's Svelte compiler compiles. A SvelteKit
server build therefore inlines this package, while nodelib-browser stays one external copy that the
app and the service clients share.

| Export                                      | Role                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `retryWhile`                                | Asks for missing data again on a backoff while a component lives; `onError` gets a failed run. |
| `createPlatformDowntime` and its context    | The planned downtime a page shows, which flips to started when its start passes.               |
| `createTelemetryPreference` and its context | The visitor's telemetry answer, which the Privacy page changes.                                |

```svelte
<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  import { createPlatformDowntime, setPlatformDowntime } from "@a-novel-kit/nodelib-svelte";

  let { data, children } = $props();

  setPlatformDowntime(createPlatformDowntime(() => data, invalidateAll));
</script>
```

Call each helper during component initialization. `retryWhile` passes the visitor's errors to
`onError` only when a run with `maxRetries` ends on a failure; pass
`(error) => telemetry.captureError(error)`, since the method needs its object.
