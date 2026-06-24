# Contributing to nodelib

For platform-wide setup (Go, Node, Podman, the `a-novel` CLI) and the day-to-day commands, see the [developer onboarding guide](https://github.com/a-novel-kit/.github/blob/master/README.md). This file documents what is specific to `nodelib`.

## Repo layout

`nodelib` is a [pnpm](https://pnpm.io) workspace. Every published package lives under `packages/*`, each exposing its source directly (no `src/` indirection) with a colocated `package.json`, `tsconfig.json`, and `vite.config.ts`:

- `packages/browser` → `@a-novel-kit/nodelib-browser`
- `packages/configs` → `@a-novel-kit/nodelib-config`
- `packages/test` → `@a-novel-kit/nodelib-test`

Shared dependency versions are pinned through the workspace catalog in `pnpm-workspace.yaml` (the `catalog:` entries in each `package.json`).

## Working in the repo

All commands run from the repo root:

- `pnpm install` — install the workspace.
- `pnpm build` — compile every package (Vite bundle + `tsc` type declarations) into its `dist/`.
- `pnpm test` — run the [Vitest](https://vitest.dev) suite; tests are colocated as `*.test.ts` files next to their sources.
- `pnpm lint` — run Prettier (style check), `tsc --noEmit` (type check), and ESLint.
- `pnpm format` — apply Prettier across the workspace.

CI runs `pnpm lint:ci` and `pnpm test:ci`, which build the config and browser packages first so the rest of the workspace can resolve them. Prettier is gated in CI, so run `pnpm format` before committing.

## Publishing

Packages are published to GitHub Packages under the `@a-novel-kit/` scope. The three packages share a single version, bumped together via `pnpm version` and released by pushing the resulting tag (`git push --follow-tags`); the release workflow builds and publishes from the tag.

## The bar for additions

`nodelib` is intentionally minimal — it holds only the cross-cutting glue that the frontends and tooling would otherwise copy between repos. Before adding to it, weigh the addition against this bar:

- **A well-maintained library already does it?** Use that library directly; do not wrap it here.
- **Only one project needs it?** Keep it in that project until a second one does.

Good additions are small, dependency-light helpers that at least two projects share and that no upstream library covers cleanly.

## Questions?

- Open an issue at https://github.com/a-novel-kit/nodelib/issues
- Check existing issues for similar problems
- Include relevant logs and environment details
