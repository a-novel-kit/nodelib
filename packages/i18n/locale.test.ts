import { resolveAcceptLanguage } from "./locale";

import { describe, expect, it } from "vitest";

const supportedLocales = ["en", "fr"] as const;

describe("resolveAcceptLanguage", () => {
  it.each([
    [null, "en"],
    ["", "en"],
    ["fr", "fr"],
    ["fr-FR", "fr"],
    ["de, fr;q=0.8, en;q=0.7", "fr"],
    ["fr;q=0.4, en;q=0.9", "en"],
    ["fr;q=0.5, en;q=0.5", "fr"],
    ["fr;q=0, *;q=1", "en"],
    ["fr;q=invalid, en;q=0.5", "en"],
    ["-, fr;q=0.5", "fr"],
  ])("resolves %s to %s", (header, expected) => {
    expect(resolveAcceptLanguage(header, supportedLocales, "en")).toBe(expected);
  });

  it("preserves the supported locale spelling", () => {
    expect(resolveAcceptLanguage("fr-fr", ["en", "fr-FR"] as const, "en")).toBe("fr-FR");
  });

  it("matches a regional preference to the first supported variant", () => {
    expect(resolveAcceptLanguage("fr-CA", ["en-US", "fr-FR"] as const, "en-US")).toBe("fr-FR");
  });

  it("rejects a default outside the supported set", () => {
    expect(() => resolveAcceptLanguage("en", ["fr"], "en")).toThrow(RangeError);
  });
});
