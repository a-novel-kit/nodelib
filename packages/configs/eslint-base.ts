import { includeIgnoreFile } from "@eslint/compat";
import type { ConfigWithExtends } from "@eslint/config-helpers";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

/** Options for {@link Eslint}, setting the ignore sources and extra rules a package needs. */
export interface EslintOptions {
  /** Extra glob patterns ESLint skips, beside `dist` and dot directories. */
  ignores?: string[];
  /** Path to a .gitignore file whose patterns are converted into ESLint ignores. */
  gitIgnorePath?: string;
  /**
   * Extra flat-config block merged into the default rules block, so a package can add or override
   * rules. Its `rules` and `languageOptions` extend the defaults one level deep. Its rules win over
   * every rule in that block.
   */
  customRules?: ConfigWithExtends;
}

/**
 * Builds the shared flat ESLint config for A-Novel TypeScript packages, ready for a package's
 * eslint.config to export as is. A package that adds rules passes `customRules`, or exports
 * `defineConfig(Eslint(opts), block)`. A Svelte package uses `EslintSvelte` from
 * `@a-novel-kit/nodelib-config/eslint-svelte` instead.
 */
export function Eslint(opts: EslintOptions = {}): ReturnType<typeof defineConfig> {
  const { presets, rules, prettier } = eslintParts(opts);
  return defineConfig([...presets, rules, prettier]);
}

/** EslintParts names the blocks of {@link Eslint}, for a preset that slots its own between them. */
export interface EslintParts {
  /** The ignores and the language presets. */
  presets: ConfigWithExtends[];
  /** The default rules block, which overrides the presets. */
  rules: ConfigWithExtends;
  /** Prettier's block, last, which switches off the formatting rules the others enable. */
  prettier: ConfigWithExtends;
}

/** Builds the blocks of {@link Eslint}. */
export function eslintParts(opts: EslintOptions): EslintParts {
  const rulesBlock: ConfigWithExtends = {
    ...opts.customRules,
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      ...opts.customRules?.languageOptions,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      ...opts.customRules?.rules,
    },
  };

  return {
    presets: [
      globalIgnores(["**/dist/**", "**/.*/**", ...(opts.ignores ?? [])]),
      ...(opts.gitIgnorePath ? [includeIgnoreFile(opts.gitIgnorePath)] : []),
      js.configs.recommended,
      ...ts.configs.recommended,
    ],
    rules: rulesBlock,
    prettier,
  };
}
