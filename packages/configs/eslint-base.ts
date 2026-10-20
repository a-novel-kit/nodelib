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
 * Builds the shared flat ESLint config for A-Novel TypeScript packages. The returned array is ready
 * to spread into a package's eslint.config. A Svelte package uses `EslintSvelte` from
 * `@a-novel-kit/nodelib-config/eslint-svelte` instead.
 *
 * The array ends with the default rules block, then Prettier's block. A later block overrides an
 * earlier one, so Prettier switches off the formatting rules the others enable.
 */
export function Eslint(opts: EslintOptions = {}): Parameters<typeof defineConfig> {
  const rulesBlock: ConfigWithExtends = {
    ...opts.customRules,
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      ...opts.customRules?.languageOptions,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
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

  return [
    globalIgnores(["**/dist/**", "**/.*/**", ...(opts.ignores ?? [])]),
    ...(opts.gitIgnorePath ? [includeIgnoreFile(opts.gitIgnorePath)] : []),
    js.configs.recommended,
    ...ts.configs.recommended,
    rulesBlock,
    prettier,
  ];
}
