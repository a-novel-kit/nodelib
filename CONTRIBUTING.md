# Contributing to nodelib

The library taxonomy — what a library is, the aggregated-vs-graduated split, and the public-package obligations a graduated package takes on — lives in the [libraries, tooling & platform concepts](https://github.com/a-novel-kit/.github/blob/master/CONTRIBUTING.md); this file covers what's specific to `nodelib`. Platform setup and day-to-day commands are in the [developer onboarding guide](https://github.com/a-novel-kit/.github/blob/master/README.md).

## Repo layout

`nodelib` is a [pnpm](https://pnpm.io) **workspace** — one repository hosting several independently published **packages** that share tooling and a single version. Each package lives under `packages/*` with its own `package.json` and build config:

- `packages/browser` → `@a-novel-kit/nodelib-browser`
- `packages/configs` → `@a-novel-kit/nodelib-config`
- `packages/i18n` → `@a-novel-kit/nodelib-i18n`
- `packages/server` → `@a-novel-kit/nodelib-server`
- `packages/test` → `@a-novel-kit/nodelib-test`

Shared dependency versions are pinned once in the `pnpm-workspace.yaml` **catalog**, so every package resolves the same version of a shared dependency.

## Working in the repo

All commands run from the repo root:

- `pnpm install` — install the workspace.
- `pnpm build` — bundle every package into its `dist/` (Vite + `tsc` declarations).
- `pnpm test` — run the [Vitest](https://vitest.dev) suite (`*.test.ts` beside its source).
- `pnpm lint` — Prettier check, `tsc --noEmit`, and ESLint.
- `pnpm format` — apply Prettier across the workspace.

CI builds the packages required by repository tooling before running lint and tests, and gates on Prettier — run `pnpm format` before committing.

## Publishing

Packages publish to GitHub Packages under `@a-novel-kit/`, and all five share one version so they release together. Cut a release from the GitHub UI (**Actions ▸ release**), choosing the bump type; the workflow bumps the shared version, tags the commit, and publishes from that tag. A protected `release` environment gates who can publish.

## The bar for additions

`nodelib` stays small on purpose. Weigh any addition against three questions:

- Does a well-maintained library already do it? Use that library; don't wrap it here.
- Does only one project need it? Keep it there until a second one does.
- Has a package grown a broad API of its own? Then it [graduates](https://github.com/a-novel-kit/.github/blob/master/CONTRIBUTING.md#libraries) out of the workspace into its own repo — taking on the public-package obligations that come with standing alone: its own README/CONTRIBUTING/SECURITY/CODE_OF_CONDUCT, Codecov, and a semver policy it holds to.

The sweet spot: a small, dependency-light helper several projects share that nothing upstream covers cleanly.

## Questions?

[Open an issue](https://github.com/a-novel-kit/nodelib/issues) — include logs and environment details.
