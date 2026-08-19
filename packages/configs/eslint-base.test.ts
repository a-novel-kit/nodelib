import { Eslint } from "./eslint-base";

import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ConfigWithExtends } from "@eslint/config-helpers";

function configsFor(options: Parameters<typeof Eslint>[0] = {}): ConfigWithExtends[] {
  return Eslint(options) as ConfigWithExtends[];
}

describe("Eslint", () => {
  it("layers ignores and consumer rules over the language defaults", () => {
    const configs = configsFor({
      ignores: ["coverage/**"],
      gitIgnorePath: path.join(process.cwd(), ".gitignore"),
      customRules: {
        languageOptions: {
          parserOptions: {
            projectService: false,
          },
        },
        rules: {
          eqeqeq: "error",
        },
      },
    });

    expect(configs[0]).toMatchObject({ ignores: ["**/dist/**", "**/.*/**", "coverage/**"] });
    expect(configs[1]).toMatchObject({
      name: "Imported .gitignore patterns",
      ignores: expect.arrayContaining(["**/node_modules", "**/coverage"]),
    });

    const consumerRules = configs.find((config) => config.rules?.eqeqeq === "error");
    expect(consumerRules).toMatchObject({
      languageOptions: {
        globals: expect.objectContaining({ process: false, window: false }),
        parserOptions: { projectService: false },
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        eqeqeq: "error",
      },
    });
  });

  it("enables the Svelte, library, and Storybook policy together", () => {
    const svelteConfig = {};
    const configs = configsFor({ isLib: true, storybook: true, svelte: svelteConfig });

    expect(configs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "svelte:recommended:rules" }),
        expect.objectContaining({ name: "storybook:recommended:stories-rules" }),
      ])
    );

    const sharedRules = configs.find((config) => config.rules?.["@typescript-eslint/no-empty-object-type"] === "off");
    expect(sharedRules?.rules).toMatchObject({
      "@typescript-eslint/no-empty-object-type": "off",
      "svelte/no-at-html-tags": "off",
      "svelte/no-navigation-without-resolve": ["error", { ignoreLinks: true }],
    });

    const parserConfig = configs.find((config) => {
      const parserOptions = config.languageOptions?.parserOptions as Record<string, unknown> | undefined;
      return parserOptions?.svelteConfig === svelteConfig;
    });
    expect(parserConfig).toMatchObject({
      files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
      languageOptions: {
        parserOptions: {
          extraFileExtensions: [".svelte"],
          projectService: true,
          svelteConfig,
        },
      },
    });
  });
});
