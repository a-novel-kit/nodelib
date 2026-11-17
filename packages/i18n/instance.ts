import { type Resource, createInstance, type i18n } from "i18next";

/** A static i18next namespace loaded from a product-owned catalog. */
export type TranslationResource = Record<string, unknown>;

/** Defines already-bundled catalogs for one isolated i18next instance. */
export interface StaticI18nOptions<Locale extends string, Namespace extends string> {
  /** Locale selected for this component tree or request. */
  locale: Locale;
  /** Source locale used when a selected catalog lacks a message. */
  defaultLocale: Locale;
  /** Namespace used when a translation key omits an explicit namespace. */
  defaultNamespace: Namespace;
  /** Namespaces available in the bundled resources. */
  namespaces: readonly Namespace[];
  /** Product-owned static catalogs, keyed by locale and namespace. */
  resources: Resource;
}

/** Rejects a namespace set that is empty or lacks the default namespace. */
function validateNamespaces<Namespace extends string>(
  defaultNamespace: Namespace,
  namespaces: readonly Namespace[]
): void {
  if (namespaces.length === 0) {
    throw new RangeError("At least one namespace is required");
  }
  if (!namespaces.includes(defaultNamespace)) {
    throw new RangeError("The default namespace must be included in the requested namespaces");
  }
}

/**
 * Creates an immediately usable i18next instance from product-owned static catalogs. Each call makes a
 * new instance, so changing one never leaks locale state to another.
 */
export function createStaticI18n<Locale extends string, Namespace extends string>(
  options: StaticI18nOptions<Locale, Namespace>
): i18n {
  validateNamespaces(options.defaultNamespace, options.namespaces);

  const instance = createInstance();
  void instance.init({
    defaultNS: options.defaultNamespace,
    fallbackLng: options.defaultLocale,
    initAsync: false,
    interpolation: {
      escapeValue: false,
    },
    lng: options.locale,
    ns: [...options.namespaces],
    resources: options.resources,
    // Extraction writes untranslated keys as "", which must render the default locale.
    returnEmptyString: false,
    returnNull: false,
  });

  return instance;
}
