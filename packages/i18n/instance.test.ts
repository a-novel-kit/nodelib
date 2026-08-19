import { type TranslationResource, createRequestI18n } from "./instance";

import { describe, expect, it, vi } from "vitest";

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
    },
  },
} satisfies Record<Locale, Record<Namespace, TranslationResource>>;

function options(locale: Locale, namespaces: readonly Namespace[] = ["common"]) {
  return {
    locale,
    defaultLocale: "en" as const,
    defaultNamespace: "common" as const,
    namespaces,
    loadNamespace: vi.fn(async (language: Locale, namespace: Namespace) => resources[language][namespace]),
  };
}

describe("createRequestI18n", () => {
  it("loads requested catalogs with source-locale fallback", async () => {
    const input = options("fr", ["common", "account"]);
    const i18n = await createRequestI18n(input);

    expect(i18n.t("ready")).toBe("Les traductions statiques sont prêtes");
    expect(i18n.t("items", { count: 2 })).toBe("2 éléments");
    expect(i18n.t("perspective", { context: "reader" })).toBe("Vue lecteur");
    expect(i18n.t("collaborators", { context: "creator", count: 2 })).toBe("2 créateurs collaborent");
    expect(i18n.t("fallback_only")).toBe("Source locale fallback");
    expect(i18n.t("account:title")).toBe("Compte");
    expect(input.loadNamespace).toHaveBeenCalledTimes(4);
  });

  it("keeps concurrent instances isolated", async () => {
    const [english, french] = await Promise.all([createRequestI18n(options("en")), createRequestI18n(options("fr"))]);

    expect(english.language).toBe("en");
    expect(french.language).toBe("fr");
    expect(french.t("ready")).toBe("Les traductions statiques sont prêtes");

    await french.changeLanguage("en");

    expect(english.language).toBe("en");
    expect(french.language).toBe("en");
    expect(english.t("ready")).toBe("Static translations are ready");
  });

  it("loads the source locale only once when it is selected", async () => {
    const input = options("en");

    await createRequestI18n(input);

    expect(input.loadNamespace).toHaveBeenCalledOnce();
    expect(input.loadNamespace).toHaveBeenCalledWith("en", "common");
  });

  it("rejects an empty namespace set", async () => {
    await expect(createRequestI18n(options("en", []))).rejects.toThrow("At least one namespace is required");
  });

  it("requires the default namespace in the requested set", async () => {
    await expect(createRequestI18n(options("en", ["account"]))).rejects.toThrow(
      "The default namespace must be included in the requested namespaces"
    );
  });
});
