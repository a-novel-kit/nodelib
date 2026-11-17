import { EslintSvelte, type EslintSvelteOptions } from "./eslint-svelte";

import { describe, expect, it } from "vitest";

import { ESLint, type Linter } from "eslint";

/** Returns the config ESLint applies to `file` under the preset. */
async function effectiveConfig(options: Partial<EslintSvelteOptions>, file: string): Promise<Linter.Config> {
  const overrideConfig = EslintSvelte({ svelte: {}, ...options });
  const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig });
  return (await eslint.calculateConfigForFile(file)) as Linter.Config;
}

/** Reads a rule's severity, 0 when the config leaves it off, then its options. */
function setting(config: Linter.Config, rule: string): unknown[] {
  return (config.rules?.[rule] as unknown[] | undefined) ?? [0];
}

function severity(config: Linter.Config, rule: string): unknown {
  return setting(config, rule)[0];
}

describe("EslintSvelte", () => {
  it.each([
    { name: "a component", file: "src/Button.svelte", svelteParser: true },
    { name: "a rune module", file: "src/state.svelte.ts", svelteParser: true },
    { name: "a TypeScript module", file: "src/index.ts", svelteParser: false },
  ])("parses $name with the Svelte config only where runes live", async ({ file, svelteParser }) => {
    const config = await effectiveConfig({ svelte: { compilerOptions: {} } }, file);
    const parserOptions = config.languageOptions?.parserOptions as Record<string, unknown> | undefined;

    expect(parserOptions?.svelteConfig).toEqual(svelteParser ? { compilerOptions: {} } : undefined);
  });

  it.each([
    {
      name: "keeps an app from rendering markup or reading import.meta.env",
      isLib: false,
      rules: { "svelte/no-at-html-tags": 2, "no-restricted-syntax": 2, "svelte/no-navigation-without-resolve": 2 },
    },
    {
      name: "lets a library link without a route table",
      isLib: true,
      rules: { "svelte/no-at-html-tags": 2, "no-restricted-syntax": 0, "svelte/no-navigation-without-resolve": 2 },
    },
  ])("$name", async ({ isLib, rules }) => {
    const config = await effectiveConfig({ isLib }, "src/Page.svelte");

    for (const [rule, level] of Object.entries(rules)) expect(severity(config, rule), rule).toBe(level);
    expect(setting(config, "svelte/no-navigation-without-resolve")[1]).toEqual(
      isLib ? { ignoreLinks: true } : undefined
    );
  });

  it.each([
    { name: "checks stories when asked", storybook: true, level: 2 },
    { name: "leaves stories to the base rules otherwise", storybook: false, level: 0 },
  ])("$name", async ({ storybook, level }) => {
    const config = await effectiveConfig({ storybook }, "src/Button.stories.ts");
    expect(severity(config, "storybook/default-exports")).toBe(level);
  });

  it("lets consumer rules override the Svelte rules", async () => {
    const config = await effectiveConfig(
      {
        customRules: { rules: { "@typescript-eslint/no-empty-object-type": "error", "svelte/no-at-html-tags": "off" } },
      },
      "src/Page.svelte"
    );

    expect(severity(config, "@typescript-eslint/no-empty-object-type")).toBe(2);
    expect(severity(config, "svelte/no-at-html-tags")).toBe(0);
  });
});
