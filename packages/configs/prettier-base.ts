import type { PrettierConfig as SortImportsConfig } from "@trivago/prettier-plugin-sort-imports";
import type { Config } from "prettier";

interface SqlPrettierConfig {
  language?: "postgresql";
  paramTypes?: string;
}

/** Options for {@link Prettier}, enabling the Svelte and SQL plugin chains a package needs. */
export interface PrettierOptions {
  svelte?: boolean;
  sql?: boolean;
}

/**
 * Builds the shared Prettier config for a-novel packages, wiring in import sorting and package.json
 * formatting. Pass {@link PrettierOptions} to add Svelte or SQL formatting.
 */
export function Prettier(opts: PrettierOptions = {}): Config & SortImportsConfig & SqlPrettierConfig {
  const baseConfig: Config & SortImportsConfig & SqlPrettierConfig = {
    useTabs: false,
    tabWidth: 2,
    trailingComma: "es5",
    semi: true,
    singleQuote: false,
    printWidth: 120,
    importOrder: [
      "^\\$",
      "^\\.(\\.)?\\/",
      "^node\\:",
      "^virtual\\:",
      "^svelte",
      "^vite",
      "^vitest",
      "^@a-novel",
      "<THIRD_PARTY_MODULES>",
    ],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
    plugins: ["@trivago/prettier-plugin-sort-imports", "prettier-plugin-packagejson"],
    overrides: [],
    htmlWhitespaceSensitivity: "strict",
  };

  if (opts.svelte) {
    baseConfig.plugins!.unshift("prettier-plugin-svelte");
    baseConfig.plugins!.push("prettier-plugin-css-order");
    baseConfig.overrides!.push({
      files: "*.svelte",
      options: {
        parser: "svelte",
        plugins: ["prettier-plugin-svelte", "@trivago/prettier-plugin-sort-imports", "prettier-plugin-css-order"],
      },
    });
  }

  if (opts.sql) {
    baseConfig.plugins!.push("prettier-plugin-sql");
    baseConfig.language = "postgresql";
    baseConfig.paramTypes = `{ numbered: ["?"] }`;
  }

  return baseConfig;
}
