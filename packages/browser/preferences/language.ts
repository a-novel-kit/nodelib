/**
 * Names the cookie that keeps the language a visitor picked over their browser's. Every app under the
 * domain reads it to render its pages in that language.
 */
export const LANGUAGE_COOKIE = "language";

/** Reads the picked language from the cookie's value, or nothing when the app does not support it. */
export function parseLanguage<Locale extends string>(
  value: string | undefined,
  supportedLocales: readonly Locale[]
): Locale | undefined {
  return supportedLocales.find((locale) => locale === value);
}
