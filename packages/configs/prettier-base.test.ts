import { Prettier } from "./prettier-base";

import { describe, expect, it } from "vitest";

describe("Prettier", () => {
  it("provides stable base formatting and import ordering", () => {
    const config = Prettier();

    expect(config).toMatchObject({
      htmlWhitespaceSensitivity: "strict",
      printWidth: 120,
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      trailingComma: "es5",
      useTabs: false,
    });
    expect(config.importOrder).toContain("<THIRD_PARTY_MODULES>");
    expect(config.plugins).toEqual(["@trivago/prettier-plugin-sort-imports", "prettier-plugin-packagejson"]);
    expect(config.overrides).toEqual([]);
    expect(config).not.toHaveProperty("language");
  });

  it("composes the Svelte and PostgreSQL plugin chains", () => {
    const config = Prettier({ sql: true, svelte: true });

    expect(config.plugins).toEqual([
      "prettier-plugin-svelte",
      "@trivago/prettier-plugin-sort-imports",
      "prettier-plugin-packagejson",
      "prettier-plugin-css-order",
      "prettier-plugin-sql",
    ]);
    expect(config.overrides).toEqual([
      {
        files: "*.svelte",
        options: {
          parser: "svelte",
          plugins: ["prettier-plugin-svelte", "@trivago/prettier-plugin-sort-imports", "prettier-plugin-css-order"],
        },
      },
    ]);
    expect(config).toMatchObject({
      language: "postgresql",
      paramTypes: `{ numbered: ["?"] }`,
    });
  });
});
