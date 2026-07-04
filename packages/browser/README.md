# Node (browser)

Browser-side helpers for the A-Novel frontends: `fetch` response handling — turning failed
responses into typed errors and validating JSON bodies against a Zod schema — under
`@a-novel-kit/nodelib-browser/http`, and standalone utilities (debounce, retry) under
`@a-novel-kit/nodelib-browser/utils`.

## Installation

> ⚠️ **Warning**: Even though the package is public, GitHub Packages requires a Personal Access Token
> with the `read:packages` scope to pull it into your project. See
> [this issue](https://github.com/orgs/community/discussions/23386#discussioncomment-3240193) for more information.

Create a `.npmrc` file at the root of your project if it doesn't exist, and make sure it contains the following:

```ini
@a-novel-kit:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${YOUR_PERSONAL_ACCESS_TOKEN}
```

Then install the package with pnpm. It declares `zod` as a peer dependency, so enable
`auto-install-peers` if your setup does not resolve peers on its own:

```bash
# pnpm config set auto-install-peers true
#  Or
# pnpm config set auto-install-peers true --location project
pnpm add @a-novel-kit/nodelib-browser
```
