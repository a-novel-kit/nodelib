import { type Resource, type ResourceLanguage, createInstance, type i18n } from "i18next";

/** A static i18next namespace loaded from a product-owned catalog. */
export type TranslationResource = Record<string, unknown>;

/** Loads one product namespace without prescribing its file or network boundary. */
export type NamespaceLoader<Locale extends string, Namespace extends string> = (
  locale: Locale,
  namespace: Namespace
) => Promise<TranslationResource>;

/** Defines the product policy required to create one isolated i18next instance. */
export interface RequestI18nOptions<Locale extends string, Namespace extends string> {
  /** Locale selected for this request. */
  locale: Locale;
  /** Source locale used when a selected catalog lacks a message. */
  defaultLocale: Locale;
  /** Namespace used when a translation key omits an explicit namespace. */
  defaultNamespace: Namespace;
  /** Namespaces required by the current request. */
  namespaces: readonly Namespace[];
  /** Product-owned catalog loader. */
  loadNamespace: NamespaceLoader<Locale, Namespace>;
}

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

/** Creates an immediately usable i18next instance from product-owned static catalogs. */
export function createStaticI18n<Locale extends string, Namespace extends string>(
  options: StaticI18nOptions<Locale, Namespace>
): i18n {
  validateNamespaces(options.defaultNamespace, options.namespaces);

  const instance = createInstance();
  void instance.init({
    compatibilityJSON: "v4",
    defaultNS: options.defaultNamespace,
    fallbackLng: options.defaultLocale,
    initAsync: false,
    interpolation: {
      escapeValue: false,
    },
    lng: options.locale,
    ns: [...options.namespaces],
    resources: options.resources,
    returnNull: false,
  });

  return instance;
}

async function loadLanguage<Locale extends string, Namespace extends string>(
  locale: Locale,
  namespaces: readonly Namespace[],
  loadNamespace: NamespaceLoader<Locale, Namespace>
): Promise<ResourceLanguage> {
  const entries = await Promise.all(
    namespaces.map(async (namespace) => [namespace, await loadNamespace(locale, namespace)] as const)
  );

  return Object.fromEntries(entries) as ResourceLanguage;
}

/** Creates an i18next instance whose locale and catalogs are isolated to one request. */
export async function createRequestI18n<Locale extends string, Namespace extends string>(
  options: RequestI18nOptions<Locale, Namespace>
): Promise<i18n> {
  validateNamespaces(options.defaultNamespace, options.namespaces);

  const resources: Resource = {
    [options.locale]: await loadLanguage(options.locale, options.namespaces, options.loadNamespace),
  };

  if (options.locale !== options.defaultLocale) {
    resources[options.defaultLocale] = await loadLanguage(
      options.defaultLocale,
      options.namespaces,
      options.loadNamespace
    );
  }

  return createStaticI18n({
    defaultLocale: options.defaultLocale,
    defaultNamespace: options.defaultNamespace,
    locale: options.locale,
    namespaces: options.namespaces,
    resources,
  });
}
