import { type TranslationResource, createStaticI18n } from "./instance";

import { describe, expect, it } from "vitest";

type Locale = "en" | "fr";
type Namespace = "account" | "common";

const resources = {
  en: {
    account: {
      title: "Account",
    },
    common: {
      collaborators_creator_one: "{{count}} creator is collaborating",
      collaborators_creator_other: "{{count}} creators are collaborating",
      fallback_only: "Source locale fallback",
      items_one: "{{count}} item",
      items_other: "{{count}} items",
      perspective_creator: "Creator view",
      perspective_reader: "Reader view",
      ready: "Static translations are ready",
      untranslated: "Awaiting translation",
    },
  },
  fr: {
    account: {
      title: "Compte",
    },
    common: {
      collaborators_creator_one: "{{count}} créateur collabore",
      collaborators_creator_many: "{{count}} créateurs collaborent",
      collaborators_creator_other: "{{count}} créateurs collaborent",
      items_one: "{{count}} élément",
      items_many: "{{count}} éléments",
      items_other: "{{count}} éléments",
      perspective_creator: "Vue créateur",
      perspective_reader: "Vue lecteur",
      ready: "Les traductions statiques sont prêtes",
      untranslated: "",
    },
  },
} satisfies Record<Locale, Record<Namespace, TranslationResource>>;

function options(locale: Locale, namespaces: readonly Namespace[] = ["common", "account"]) {
  return { locale, defaultLocale: "en" as const, defaultNamespace: "common" as const, namespaces, resources };
}

describe("createStaticI18n", () => {
  it("returns an immediately usable instance backed by bundled catalogs", () => {
    const i18n = createStaticI18n(options("fr"));

    expect(i18n.t("ready")).toBe("Les traductions statiques sont prêtes");
    expect(i18n.t("items", { count: 2 })).toBe("2 éléments");
    expect(i18n.t("perspective", { context: "reader" })).toBe("Vue lecteur");
    expect(i18n.t("collaborators", { context: "creator", count: 2 })).toBe("2 créateurs collaborent");
    expect(i18n.t("fallback_only")).toBe("Source locale fallback");
    expect(i18n.t("untranslated")).toBe("Awaiting translation");
    expect(i18n.t("account:title")).toBe("Compte");
  });

  it("keeps instances isolated", async () => {
    const english = createStaticI18n(options("en"));
    const french = createStaticI18n(options("fr"));

    await french.changeLanguage("en");

    expect(english.language).toBe("en");
    expect(french.language).toBe("en");
    expect(english.t("ready")).toBe("Static translations are ready");
  });

  it.each([
    { name: "rejects an empty namespace set", namespaces: [], message: "At least one namespace is required" },
    {
      name: "requires the default namespace in the namespace set",
      namespaces: ["account" as const],
      message: "The default namespace must be included in the requested namespaces",
    },
  ])("$name", ({ namespaces, message }) => {
    expect(() => createStaticI18n(options("en", namespaces))).toThrow(message);
  });
});
