# Contributing to nodelib

Platform setup and day-to-day commands are in the [developer onboarding guide](https://github.com/a-novel-kit/.github/blob/master/README.md). This file covers what's specific to `nodelib`.

## Repo layout

`nodelib` is a [pnpm](https://pnpm.io) workspace. Every published package lives under `packages/*` with its own `package.json` and build config:

- `packages/browser` → `@a-novel-kit/nodelib-browser`
- `packages/configs` → `@a-novel-kit/nodelib-config`
- `packages/test` → `@a-novel-kit/nodelib-test`

Shared dependency versions are pinned via the `pnpm-workspace.yaml` catalog.

## Working in the repo

All commands run from the repo root:

- `pnpm install` — install the workspace.
- `pnpm build` — bundle every package into its `dist/` (Vite + `tsc` declarations).
- `pnpm test` — run the [Vitest](https://vitest.dev) suite (`*.test.ts` beside its source).
- `pnpm lint` — Prettier check, `tsc --noEmit`, and ESLint.
- `pnpm format` — apply Prettier across the workspace.

CI builds the config and browser packages first so the rest can resolve them, and gates on Prettier — run `pnpm format` before committing.

## Publishing

Packages publish to GitHub Packages under `@a-novel-kit/`. All three share one version: bump them together (`pnpm version`) and push the tag (`git push --follow-tags`); the release workflow publishes from it.

## The bar for additions

`nodelib` stays small on purpose. Weigh any addition against two questions:

- Does a well-maintained library already do it? Use that library; don't wrap it here.
- Does only one project need it? Keep it there until a second one does.

The sweet spot: a small, dependency-light helper several projects share that nothing upstream covers cleanly.

## Questions?

[Open an issue](https://github.com/a-novel-kit/nodelib/issues) — include logs and environment details.
