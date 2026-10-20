import { includeIgnoreFile } from "@eslint/compat";
import type { ConfigWithExtends } from "@eslint/config-helpers";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import storybook from "eslint-plugin-storybook";
import svelte from "eslint-plugin-svelte";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

/** Options for {@link Eslint}, toggling the framework plugins and ignore sources a package needs. */
export interface EslintOptions {
  /** Treats the package as a reusable library, relaxing rules that assume a deployed app with a fixed route table. */
  isLib?: boolean;
  /** Svelte config. When provided, it enables Svelte parsing and its recommended and Prettier rule sets. */
  svelte?: object;
  /** Enables the recommended Storybook rules. */
  storybook?: boolean;
  /** Extra glob patterns ESLint skips, beside `dist` and dot directories. */
  ignores?: string[];
  /** Path to a .gitignore file whose patterns are converted into ESLint ignores. */
  gitIgnorePath?: string;
  /**
   * Extra flat-config block merged into the default rules block, so a package can add or override
   * rules. Its `rules` and `languageOptions` extend the defaults one level deep. Its rules win over
   * every rule in that block, the Svelte exemptions included.
   */
  customRules?: ConfigWithExtends;
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
 * Builds the shared flat ESLint config for A-Novel Node and Svelte packages. The returned array is
 * ready to spread into a package's eslint.config. Pass {@link EslintOptions} to enable Svelte,
 * Storybook, or library-specific rules.
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
      // A library's links stay generic, with no route table of its own to resolve them against.
      ...(opts.svelte && opts.isLib && { "svelte/no-navigation-without-resolve": ["error", { ignoreLinks: true }] }),
      ...(opts.svelte && {
        "@typescript-eslint/no-empty-object-type": "off",
        // Consuming packages render only internal content through {@html}.
        "svelte/no-at-html-tags": "off",
      }),
      ...opts.customRules?.rules,
    },
  };

  // A later block overrides an earlier one, so Prettier's blocks go last, where they switch off the
  // formatting rules the others enable.
  return [
    globalIgnores(["**/dist/**", "**/.*/**", ...(opts.ignores ?? [])]),
    ...(opts.gitIgnorePath ? [includeIgnoreFile(opts.gitIgnorePath)] : []),
    js.configs.recommended,
    ...ts.configs.recommended,
    ...(opts.svelte ? svelte.configs.recommended : []),
    ...(opts.storybook ? (storybook.configs["flat/recommended"] as ConfigWithExtends[]) : []),
    rulesBlock,
    ...(opts.svelte ? [svelteParser(opts.svelte)] : []),
    prettier,
    ...(opts.svelte ? svelte.configs.prettier : []),
  ];
}
