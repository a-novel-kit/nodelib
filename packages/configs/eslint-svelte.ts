import { type EslintOptions, eslintParts } from "./eslint-base.js";

import type { ConfigWithExtends } from "@eslint/config-helpers";
import storybook from "eslint-plugin-storybook";
import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import ts from "typescript-eslint";

/** Options for {@link EslintSvelte}, adding the Svelte and Storybook policy to {@link EslintOptions}. */
export interface EslintSvelteOptions extends EslintOptions {
  /** Svelte config handed to the parser of Svelte components and rune modules. */
  svelte: object;
  /**
   * Treats the package as a reusable library, relaxing the rules that assume a deployed app: a fixed
   * route table, and configuration read from SvelteKit's environment modules.
   */
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

// Vite inlines every import.meta.env value it reads into the browser bundle.
const importMetaEnv = {
  selector: "MemberExpression[object.type='MetaProperty'][property.name='env']",
  message: "Declare configuration in src/env.ts and read it from $app/env/private or $app/env/public.",
};

/**
 * Builds the shared flat ESLint config for A-Novel Svelte packages: the `Eslint` config with Svelte
 * parsing and the recommended Svelte rules, plus the recommended Storybook rules on request.
 *
 * `{@html}` stays an error, since an app renders what its users write. An app reads its configuration
 * from SvelteKit's environment modules, where a variable stays server-only unless declared public,
 * never from `import.meta.env`. The Svelte rules join the default rules block, so `customRules`
 * can override them.
 */
export function EslintSvelte(opts: EslintSvelteOptions): ReturnType<typeof defineConfig> {
  const { svelte: svelteConfig, isLib, storybook: withStorybook, ...baseOpts } = opts;
  const customRules: ConfigWithExtends = {
    ...opts.customRules,
    rules: {
      // A library's links stay generic, with no route table of its own to resolve them against, and only
      // an app has SvelteKit's environment modules to read.
      ...(isLib
        ? { "svelte/no-navigation-without-resolve": ["error", { ignoreLinks: true }] }
        : { "no-restricted-syntax": ["error", importMetaEnv] }),
      "@typescript-eslint/no-empty-object-type": "off",
      ...opts.customRules?.rules,
    },
  };

  // The Svelte and Storybook presets go before the default rules block, which overrides them, and
  // Svelte's Prettier block goes last.
  const { presets, rules, prettier } = eslintParts({ ...baseOpts, customRules });

  return defineConfig([
    ...presets,
    ...svelte.configs.recommended,
    ...(withStorybook ? (storybook.configs["flat/recommended"] as ConfigWithExtends[]) : []),
    rules,
    svelteParser(svelteConfig),
    prettier,
    ...svelte.configs.prettier,
  ]);
}
