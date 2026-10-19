# Contributing to nodelib

This guide covers what is specific to `nodelib`. The [developer guide](https://a-novel-kit.github.io/stack/) sets up the platform. The [library taxonomy](https://github.com/a-novel-kit/.github/blob/master/docs/taxonomy.md#libraries) defines what a library is, and when a package graduates to its own repository.

## Repo layout

`nodelib` is a [pnpm](https://pnpm.io) workspace. One repository hosts several packages that share tooling and a single version. Each package lives under `packages/*`, with its own `package.json` and build config:

| Directory          | Package                        |
| ------------------ | ------------------------------ |
| `packages/browser` | `@a-novel-kit/nodelib-browser` |
| `packages/configs` | `@a-novel-kit/nodelib-config`  |
| `packages/i18n`    | `@a-novel-kit/nodelib-i18n`    |
| `packages/server`  | `@a-novel-kit/nodelib-server`  |
| `packages/test`    | `@a-novel-kit/nodelib-test`    |

The `pnpm-workspace.yaml` **catalog** pins each shared dependency once, so every package resolves the same version. `vite.library.ts` holds the build every package shares.

## Working in the repo

Run every command from the repo root. Install the workspace, then build it once:

```bash
pnpm install
pnpm build
```

The workspace formats and lints itself with its own config package, read from `dist/`. Rebuild after a change to `packages/configs`.

```bash
pnpm format    # apply Prettier
pnpm lint      # Prettier check, type check and ESLint
pnpm test      # Vitest, with each *.test.ts beside its source
```

CI runs `pnpm lint:ci` and `pnpm test:ci`, which build the packages they read first. Run `pnpm format` before committing, since CI fails on any Prettier difference.

## Publishing

All five packages share one version and release together to GitHub Packages. Cut a release from **Actions → release**, and pick the bump type. The workflow bumps the version and tags the commit, and the tag publishes the packages. The protected `release` environment decides who can cut a release.

## The bar for additions

`nodelib` stays small. Weigh any addition against three questions:

- Does a well-maintained library already do it? Use that library, without a wrapper here.
- Does only one project need it? Keep it there until a second one does.
- Has a package grown a broad API of its own? It then [graduates](https://github.com/a-novel-kit/.github/blob/master/docs/taxonomy.md#libraries) into its own repository, with the obligations of a standalone public package.

A good fit is a small, dependency-light helper that several projects share and nothing upstream covers cleanly.

## Questions?

[Open an issue](https://github.com/a-novel-kit/nodelib/issues) with logs and environment details.
