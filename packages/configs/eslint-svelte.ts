import { Eslint, type EslintOptions } from "./eslint-base.js";

import type { ConfigWithExtends } from "@eslint/config-helpers";
import storybook from "eslint-plugin-storybook";
import svelte from "eslint-plugin-svelte";
import type { defineConfig } from "eslint/config";
import ts from "typescript-eslint";

/** Options for {@link EslintSvelte}, adding the Svelte and Storybook policy to {@link EslintOptions}. */
export interface EslintSvelteOptions extends EslintOptions {
  /** Svelte config handed to the parser of Svelte components and rune modules. */
  svelte: object;
  /** Treats the package as a reusable library, relaxing rules that assume a deployed app with a fixed route table. */
  isLib?: boolean;
  /** Enables the recommended Storybook rules. */
  storybook?: boolean;
}

/** Parses Svelte components, and the modules their runes live in, with TypeScript's project service. */
function svelteParser(svelteConfig: object): ConfigWithExtends {
  return {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
        svelteConfig,
      },
    },
  };
}

/**
 * Builds the shared flat ESLint config for A-Novel Svelte packages: the {@link Eslint} config with
 * Svelte parsing and the recommended Svelte rules, plus the recommended Storybook rules on request.
 *
 * The Svelte exemptions join the default rules block, so `customRules` can re-enable them.
 */
export function EslintSvelte(opts: EslintSvelteOptions): Parameters<typeof defineConfig> {
  const { svelte: svelteConfig, isLib, storybook: withStorybook, ...baseOpts } = opts;
  const customRules: ConfigWithExtends = {
    ...opts.customRules,
    rules: {
      // A library's links stay generic, with no route table of its own to resolve them against.
      ...(isLib && { "svelte/no-navigation-without-resolve": ["error", { ignoreLinks: true }] }),
      "@typescript-eslint/no-empty-object-type": "off",
      // Consuming packages render only internal content through {@html}.
      "svelte/no-at-html-tags": "off",
      ...opts.customRules?.rules,
    },
  };

  // Eslint ends with its default rules block and Prettier's block. The Svelte and Storybook presets go
  // before the rules block, which overrides them, and Svelte's Prettier block goes last.
  const base = Eslint({ ...baseOpts, customRules });
  const [rulesBlock, prettier] = base.splice(-2);

  return [
    ...base,
    ...svelte.configs.recommended,
    ...(withStorybook ? (storybook.configs["flat/recommended"] as ConfigWithExtends[]) : []),
    rulesBlock,
    svelteParser(svelteConfig),
    prettier,
    ...svelte.configs.prettier,
  ];
}
