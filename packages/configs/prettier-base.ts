import type { PrettierConfig as SortImportsConfig } from "@trivago/prettier-plugin-sort-imports";
import type { Config } from "prettier";

interface SqlPrettierConfig {
  language?: "postgresql";
  paramTypes?: string;
}

/** Options for {@link Prettier}, enabling the Svelte and SQL plugin chains a package needs. */
export interface PrettierOptions {
  /** Formats Svelte components and orders CSS properties. */
  svelte?: boolean;
  /** Formats SQL files as PostgreSQL. */
  sql?: boolean;
}

/**
 * Builds the shared Prettier config for A-Novel packages, with import sorting and package.json
 * formatting. Pass {@link PrettierOptions} to add Svelte or SQL formatting.
 */
export function Prettier(opts: PrettierOptions = {}): Config & SortImportsConfig & SqlPrettierConfig {
  const svelteOverride = {
    files: "*.svelte",
    options: {
      parser: "svelte",
      plugins: ["prettier-plugin-svelte", "@trivago/prettier-plugin-sort-imports", "prettier-plugin-css-order"],
    },
  };

  return {
    useTabs: false,
    tabWidth: 2,
    trailingComma: "es5",
    semi: true,
    singleQuote: false,
    printWidth: 120,
    importOrder: [
      "^[\\$#]",
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
    plugins: [
      ...(opts.svelte ? ["prettier-plugin-svelte"] : []),
      "@trivago/prettier-plugin-sort-imports",
      "prettier-plugin-packagejson",
      ...(opts.svelte ? ["prettier-plugin-css-order"] : []),
      ...(opts.sql ? ["prettier-plugin-sql"] : []),
    ],
    overrides: opts.svelte ? [svelteOverride] : [],
    htmlWhitespaceSensitivity: "strict",
    ...(opts.sql && { language: "postgresql", paramTypes: `{ numbered: ["?"] }` }),
  };
}
