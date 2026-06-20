# Node lib

Shared Node.js libraries.

[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/agorastoryverse)](https://twitter.com/agorastoryverse)
[![Discord](https://img.shields.io/discord/1315240114691248138?logo=discord)](https://discord.gg/rp4Qr8cA)

<hr />

![GitHub repo file or directory count](https://img.shields.io/github/directory-file-count/a-novel-kit/nodelib)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/a-novel-kit/nodelib)

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/a-novel-kit/nodelib/main.yaml)
[![codecov](https://codecov.io/gh/a-novel-kit/nodelib/graph/badge.svg)](https://codecov.io/gh/a-novel-kit/nodelib)

![Coverage graph](https://codecov.io/gh/a-novel-kit/nodelib/graphs/sunburst.svg)

## Installation

> ⚠️ **Warning**: Even though the package is public, GitHub registry requires you to have a Personal Access Token
> with `repo` and `read:packages` scopes to pull it in your project. See
> [this issue](https://github.com/orgs/community/discussions/23386#discussioncomment-3240193) for more information.

Create a `.npmrc` file in the root of your project if it doesn't exist, and make sure it contains the following:

```ini
@a-novel-kit:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${YOUR_PERSONAL_ACCESS_TOKEN}
```

Then, install the package using pnpm (you can install any package independently):

```bash
# pnpm config set auto-install-peers true
#  Or
# pnpm config set auto-install-peers true --location project
pnpm add -D @a-novel-kit/nodelib-test
pnpm add -D @a-novel-kit/nodelib-config
pnpm add @a-novel-kit/nodelib-browser
```
