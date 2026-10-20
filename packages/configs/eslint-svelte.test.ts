import { Eslint } from "./eslint-base";
import { EslintSvelte } from "./eslint-svelte";

import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ConfigWithExtends } from "@eslint/config-helpers";
import storybook from "eslint-plugin-storybook";
import svelte from "eslint-plugin-svelte";
import ts from "typescript-eslint";

const gitIgnorePath = path.join(process.cwd(), ".gitignore");
const svelteConfig = {};

/** Reads a rule's setting from the last block declaring it, which wins for every file that block matches. */
function effectiveRule(configs: ConfigWithExtends[], name: string): unknown {
  return configs.findLast((config) => config.rules?.[name] !== undefined)?.rules?.[name];
}

const layoutCases = [
  {
    name: "a Svelte library",
    base: { gitIgnorePath },
    framework: { svelte: svelteConfig, isLib: true },
    storybookBlocks: [],
    libraryRules: { "svelte/no-navigation-without-resolve": ["error", { ignoreLinks: true }] },
  },
  {
    name: "a Svelte app with Storybook",
    base: { gitIgnorePath, ignores: ["src/lib/i18n/generated/**"] },
    framework: { svelte: svelteConfig, storybook: true },
    storybookBlocks: storybook.configs["flat/recommended"],
    libraryRules: {},
  },
];

describe("EslintSvelte", () => {
  it.each(layoutCases)(
    "wraps the base config in the Svelte blocks for $name",
    ({ base, framework, storybookBlocks, libraryRules }) => {
      const [ignoresBlock, ...presets] = Eslint(base) as ConfigWithExtends[];
      const [rulesBlock, prettier] = presets.splice(-2);

      expect(EslintSvelte({ ...base, ...framework })).toEqual([
        // globalIgnores names each block from a global counter, so two calls never share a name.
        { ...ignoresBlock, name: expect.any(String) },
        ...presets,
        ...svelte.configs.recommended,
        ...storybookBlocks,
        {
          ...rulesBlock,
          rules: {
            ...rulesBlock.rules,
            ...libraryRules,
            "@typescript-eslint/no-empty-object-type": "off",
            "svelte/no-at-html-tags": "off",
          },
        },
        {
          files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
          languageOptions: {
            parserOptions: { projectService: true, extraFileExtensions: [".svelte"], parser: ts.parser, svelteConfig },
          },
        },
        prettier,
        ...svelte.configs.prettier,
      ]);
    }
  );

  it("lets consumer rules re-enable the Svelte exemptions", () => {
    const configs = EslintSvelte({
      svelte: svelteConfig,
      customRules: {
        rules: {
          "@typescript-eslint/no-empty-object-type": "error",
          "svelte/no-at-html-tags": "error",
        },
      },
    }) as ConfigWithExtends[];

    expect(effectiveRule(configs, "@typescript-eslint/no-empty-object-type")).toBe("error");
    expect(effectiveRule(configs, "svelte/no-at-html-tags")).toBe("error");
  });
});
