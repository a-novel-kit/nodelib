# Migration guides

Each guide lists what a consumer must change to adopt the release that introduced it.

- [v2.13.0](./v2.13.0.md): nodelib takes in the code every service client and every platform copies: a `RestClient` base, the Svelte helpers, the end-to-end harness and the preset overrides. It also drops the exports no repository uses.
- [v2.12.0](./v2.12.0.md): `nodelib-server` traces with `@opentelemetry/sdk-trace`, which replaces the deprecated `@opentelemetry/sdk-trace-node`.
- [v2.11.0](v2.11.0.md): `nodelib-i18n` requires i18next 27
- [v2.6.0](v2.6.0.md): Browser telemetry reports to Grafana Faro instead of Sentry
- [v2.2.0](v2.2.0.md): Telemetry exports over OTLP to any backend instead of to Google Cloud
- [v2.0.0](v2.0.0.md): Svelte lint config moves to `./eslint-svelte`; `HttpError` fields turn public
- [v1.11.0](v1.11.0.md): `nodelib-test` drops its unused `./msw` entry
- [v1.8.0](v1.8.0.md): SvelteKit 3: options move from `svelte.config.js` to Vite
