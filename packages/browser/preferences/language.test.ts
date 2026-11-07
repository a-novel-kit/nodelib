import { parseLanguage } from "./language";

import { describe, expect, it } from "vitest";

describe("parseLanguage", () => {
  const supportedLocales = ["en", "fr"] as const;

  it.each([
    { name: "reads a supported language", value: "fr", want: "fr" },
    { name: "ignores a language the app does not support", value: "de", want: undefined },
    { name: "matches the exact tag only", value: "FR", want: undefined },
    { name: "reads nothing for a visitor who never picked", value: undefined, want: undefined },
  ])("$name", ({ value, want }) => {
    expect(parseLanguage(value, supportedLocales)).toBe(want);
  });
});
