interface LanguagePreference {
  index: number;
  quality: number;
  range: string;
}

/**
 * Reads one Accept-Language element: a language range and its weight (RFC 9110 §12.4.2). An
 * unreadable weight is 0, which drops the element.
 */
function parsePreference(element: string, index: number): LanguagePreference {
  const [range = "", ...parameters] = element.split(";");
  const qualityParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith("q="));
  const quality = qualityParameter ? Number.parseFloat(qualityParameter.trim().slice(2)) : 1;

  return {
    index,
    quality: quality >= 0 && quality <= 1 ? quality : 0,
    range: range.trim().toLowerCase(),
  };
}

function parsePreferences(acceptLanguage: string): LanguagePreference[] {
  return acceptLanguage
    .split(",")
    .map(parsePreference)
    .filter(({ quality, range }) => quality > 0 && range.length > 0 && range !== "*")
    .sort((left, right) => right.quality - left.quality || left.index - right.index);
}

/**
 * Finds the supported locale a language range names by RFC 4647 §3.4 Lookup: the range, then the
 * range truncated one subtag at a time. A single-character subtag, such as the `x` opening a
 * private-use sequence, goes with the subtag after it.
 */
function lookup<Locale extends string>(range: string, supportedByTag: ReadonlyMap<string, Locale>): Locale | undefined {
  const subtags = range.split("-");
  while (subtags.length > 0) {
    const locale = supportedByTag.get(subtags.join("-"));
    if (locale) return locale;

    subtags.pop();
    if (subtags.at(-1)?.length === 1) subtags.pop();
  }

  return undefined;
}

/**
 * Selects the supported locale an Accept-Language header value prefers (RFC 9110 §12.5.4), or the
 * default one. Ranges are tried by descending weight, in header order on a tie. Each range goes
 * through RFC 4647 §3.4 Lookup, the matching scheme that selects one tag.
 *
 * A range that Lookup leaves unmatched takes the first supported locale of its language, so `fr-CA`
 * reaches `fr-FR`: a visitor reads any variant of their language better than the default locale. A
 * weight of 0 only drops its range, since RFC 9110 lets a server disregard the field.
 */
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

  for (const { range } of parsePreferences(acceptLanguage)) {
    const [language = ""] = range.split("-", 1);
    const locale = lookup(range, supportedByTag) ?? supportedByLanguage.get(language);
    if (locale) return locale;
  }

  return defaultLocale;
}
