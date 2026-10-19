interface LanguagePreference {
  index: number;
  quality: number;
  tag: string;
}

/** Reads one Accept-Language entry. An unreadable quality weighs 0, which drops the entry. */
function parsePreference(entry: string, index: number): LanguagePreference {
  const [tag = "", ...parameters] = entry.trim().split(";");
  const qualityParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith("q="));
  const quality = qualityParameter ? Number.parseFloat(qualityParameter.trim().slice(2)) : 1;

  return {
    index,
    quality: quality >= 0 && quality <= 1 ? quality : 0,
    tag: tag.toLowerCase(),
  };
}

function parsePreferences(acceptLanguage: string): LanguagePreference[] {
  return acceptLanguage
    .split(",")
    .map(parsePreference)
    .filter(({ quality, tag }) => quality > 0 && tag.length > 0 && tag !== "*")
    .sort((left, right) => right.quality - left.quality || left.index - right.index);
}

/** Selects the highest-quality supported locale from an Accept-Language header value. */
export function resolveAcceptLanguage<Locale extends string>(
  acceptLanguage: string | null | undefined,
  supportedLocales: readonly Locale[],
  defaultLocale: Locale
): Locale {
  if (!supportedLocales.includes(defaultLocale)) {
    throw new RangeError("The default locale must be included in the supported locale list");
  }

  if (!acceptLanguage) return defaultLocale;

  const supportedByTag = new Map(supportedLocales.map((locale) => [locale.toLowerCase(), locale]));
  const supportedByLanguage = new Map<string, Locale>();

  for (const locale of supportedLocales) {
    const [language] = locale.toLowerCase().split("-");
    if (language && !supportedByLanguage.has(language)) {
      supportedByLanguage.set(language, locale);
    }
  }

  for (const { tag } of parsePreferences(acceptLanguage)) {
    const exactLocale = supportedByTag.get(tag);
    if (exactLocale) return exactLocale;

    const [language] = tag.split("-");
    if (!language) continue;

    const languageLocale = supportedByTag.get(language) ?? supportedByLanguage.get(language);
    if (languageLocale) return languageLocale;
  }

  return defaultLocale;
}
