import { I18next, type I18nextOptions } from "./i18next";

import { describe, expect, it } from "vitest";

describe("I18next", () => {
  it("derives the static catalog and generated-type layout", () => {
    const config = I18next({
      locales: ["en", "fr"],
      primaryLanguage: "en",
    });

    expect(config.extract).toMatchObject({
      defaultNS: "common",
      input: ["src/**/*.{svelte,ts}"],
      output: "src/lib/i18n/locales/{{language}}/{{namespace}}.json",
      primaryLanguage: "en",
      secondaryLanguages: ["fr"],
      removeUnusedKeys: true,
      outputFormat: "json",
      warnOnConflicts: "error",
    });
    expect(config.types).toMatchObject({
      basePath: "src/lib/i18n/locales/en",
      output: "src/lib/i18n/generated/i18next.d.ts",
      resourcesFile: "src/lib/i18n/generated/resources.d.ts",
    });
    expect(config.plugins).toHaveLength(1);
  });

  it("accepts product paths without replacing safety defaults", () => {
    const config = I18next({
      locales: ["en"],
      primaryLanguage: "en",
      rootDirectory: "fixtures/i18n",
      input: ["fixtures/**/*.svelte"],
      extract: {
        preservePatterns: ["runtime.allowed.*"],
      },
    });

    expect(config.extract).toMatchObject({
      input: ["fixtures/**/*.svelte"],
      output: "fixtures/i18n/locales/{{language}}/{{namespace}}.json",
      preservePatterns: ["runtime.allowed.*"],
      removeUnusedKeys: true,
    });
  });

  it("protects the static catalog contract from untyped overrides", () => {
    const unsafeOverrides = {
      defaultNS: "unsafe",
      extractFromComments: true,
      functions: ["translate"],
      generateBasePluralForms: true,
      ignore: [],
      indentation: 4,
      input: ["unsafe/**/*"],
      mergeNamespaces: true,
      output: "unsafe.yaml",
      outputFormat: "yaml",
      preservePatterns: ["runtime.allowed.*"],
      primaryLanguage: "fr",
      removeUnusedKeys: false,
      secondaryLanguages: [],
      sort: false,
      warnOnConflicts: false,
    } as unknown as NonNullable<I18nextOptions["extract"]>;

    const config = I18next({
      locales: ["en", "fr"],
      primaryLanguage: "en",
      extract: unsafeOverrides,
    });

    expect(config.extract).toMatchObject({
      defaultNS: "common",
      extractFromComments: false,
      functions: ["translate"],
      generateBasePluralForms: false,
      ignore: ["src/**/*.test.ts", "src/lib/i18n/generated/**"],
      indentation: 2,
      input: ["src/**/*.{svelte,ts}"],
      mergeNamespaces: false,
      output: "src/lib/i18n/locales/{{language}}/{{namespace}}.json",
      outputFormat: "json",
      preservePatterns: ["runtime.allowed.*"],
      primaryLanguage: "en",
      removeUnusedKeys: true,
      secondaryLanguages: ["fr"],
      sort: true,
      warnOnConflicts: "error",
    });
  });
});
