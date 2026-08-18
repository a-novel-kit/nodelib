import { I18next } from "./i18next";

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
});
