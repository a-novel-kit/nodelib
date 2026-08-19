# @a-novel-kit/nodelib-i18n

Framework-agnostic localization runtime helpers for request-rendered applications.

## Installation

GitHub Packages requires a token with `read:packages` even for public packages. Configure the
`@a-novel-kit` registry, then install the package with its i18next peer:

```bash
pnpm add @a-novel-kit/nodelib-i18n i18next
```

## Usage

The caller owns its supported locales, namespaces, and static catalog loaders. A new i18next
instance is returned for each request, so changing one instance cannot leak locale state to another.

```ts
import { createRequestI18n, resolveAcceptLanguage } from "@a-novel-kit/nodelib-i18n";

const supportedLocales = ["en", "fr"] as const;
const locale = resolveAcceptLanguage(request.headers.get("accept-language"), supportedLocales, "en");

const i18n = await createRequestI18n({
  locale,
  defaultLocale: "en",
  defaultNamespace: "common",
  namespaces: ["common"],
  loadNamespace: async (language, namespace) => (await import(`./locales/${language}/${namespace}.json`)).default,
});
```
