# @a-novel-kit/nodelib-i18n

Scoped localization runtime helpers for request-rendered applications.

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

## Bundled catalogs in Svelte

Install Svelte alongside the package when using its optional `./svelte` entry point. Keep product
catalogs in the product repository and create one instance per rendered component tree. Bundled
resources initialize synchronously, so descendants can translate during their first render.

```svelte
<!-- StudioI18nProvider.svelte -->
<script lang="ts">
  import resources from "./resources";

  import type { Snippet } from "svelte";

  import { createStaticI18n } from "@a-novel-kit/nodelib-i18n";
  import { setI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  let { children, locale }: { children: Snippet; locale: "en" | "fr" } = $props();

  setI18nContext(
    createStaticI18n({
      locale,
      defaultLocale: "en",
      defaultNamespace: "common",
      namespaces: ["common"],
      resources,
    })
  );
</script>

{@render children()}
```

Components read the native context and translate each message where it is rendered:

```svelte
<script lang="ts">
  import { getI18nContext } from "@a-novel-kit/nodelib-i18n/svelte";

  const { t } = getI18nContext();
</script>

<h1>{t("shell.home")}</h1>
```

Use the same provider as a global Storybook decorator or test wrapper. The context belongs to the
component tree, so concurrent server renders do not share mutable locale state.
