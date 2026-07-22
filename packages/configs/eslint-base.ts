import { includeIgnoreFile } from "@eslint/compat";
import type { ConfigWithExtends } from "@eslint/config-helpers";
import js from "@eslint/js";
import type { Config as SvelteConfig } from "@sveltejs/kit";
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
  /** Svelte config; when provided, enables Svelte parsing and its recommended and Prettier rule sets. */
  svelte?: SvelteConfig;
  storybook?: boolean;
  ignores?: string[];
  /** Path to a .gitignore file whose patterns are converted into ESLint ignores. */
  gitIgnorePath?: string;
  /** Extra flat-config block deep-merged over the defaults, so a package can add or override rules. */
  customRules?: ConfigWithExtends;
}

/**
 * Builds the shared flat ESLint config for a-novel Node and Svelte packages. The returned array is
 * ready to spread into a package's eslint.config; pass {@link EslintOptions} to enable Svelte,
 * Storybook, or library-specific rules.
 */
export function Eslint(opts: EslintOptions = {}): Parameters<typeof defineConfig> {
  let customRules: ConfigWithExtends = {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
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
    },
  };

  // In library mode links can be generic and reusable, with no concrete route table to resolve against.
  if (opts.svelte && opts.isLib) {
    customRules.rules!["svelte/no-navigation-without-resolve"] = ["error", { ignoreLinks: true }];
  }

  if (opts.customRules) {
    customRules = {
      ...opts.customRules,
      languageOptions: {
        ...customRules.languageOptions,
        ...opts.customRules.languageOptions,
      },
      rules: {
        ...customRules.rules,
        ...opts.customRules.rules,
      },
    };
  }

  // Flat config lets later blocks override earlier ones, so blocks are grouped by precedence and
  // the Prettier style block goes last, where it can switch off formatting rules the others enable.
  const sortedRules: Record<string, ConfigWithExtends[]> = {
    ignoreRules: [globalIgnores(["**/dist/**", "**/.*/**", ...(opts.ignores ?? [])])],
    langRules: [js.configs.recommended, ...ts.configs.recommended],
    frameworkRules: [],
    customRules: [customRules],
    styleRules: [prettier],
  };

  if (opts.svelte) {
    sortedRules.langRules.push(...svelte.configs.recommended);
    sortedRules.styleRules.push(...svelte.configs.prettier);
    sortedRules.customRules.push({
      files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
      languageOptions: {
        parserOptions: {
          projectService: true,
          extraFileExtensions: [".svelte"],
          parser: ts.parser,
          svelteConfig: opts.svelte,
        },
      },
    });
    customRules.rules!["@typescript-eslint/no-empty-object-type"] = "off";
    // Consuming packages render only internal content through {@html}.
    customRules.rules!["svelte/no-at-html-tags"] = "off";
  }

  if (opts.gitIgnorePath) {
    sortedRules.ignoreRules.push(includeIgnoreFile(opts.gitIgnorePath));
  }

  if (opts.storybook) {
    sortedRules.frameworkRules.push(...(storybook.configs["flat/recommended"] as ConfigWithExtends[]));
  }

  return [
    ...sortedRules.ignoreRules,
    ...sortedRules.langRules,
    ...sortedRules.frameworkRules,
    ...sortedRules.customRules,
    ...sortedRules.styleRules,
  ];
}
