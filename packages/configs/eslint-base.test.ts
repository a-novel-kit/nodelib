import { Eslint, type EslintOptions } from "./eslint-base";

import path from "node:path";

import { describe, expect, it } from "vitest";

import { ESLint, type Linter } from "eslint";

/** Returns the config ESLint applies to `file` under the preset, or undefined when the preset ignores it. */
async function effectiveConfig(options: EslintOptions, file: string): Promise<Linter.Config | undefined> {
  const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: Eslint(options) });
  return await eslint.calculateConfigForFile(file);
}

describe("Eslint", () => {
  it("lints TypeScript with the strict defaults and the consumer's rules", async () => {
    const config = await effectiveConfig({ customRules: { rules: { eqeqeq: "error" } } }, "src/index.ts");

    const severity = (rule: string) => (config?.rules?.[rule] as unknown[] | undefined)?.[0];

    expect(severity("@typescript-eslint/ban-ts-comment")).toBe(2);
    expect(severity("@typescript-eslint/no-explicit-any")).toBe(2);
    expect(severity("eqeqeq")).toBe(2);
    // Prettier's block comes last, and switches off what the formatter owns.
    expect(severity("no-unexpected-multiline")).toBe(0);
    expect(config?.rules?.["@typescript-eslint/no-unused-vars"]).toEqual([
      2,
      expect.objectContaining({ argsIgnorePattern: "^_", varsIgnorePattern: "^_" }),
    ]);
    expect(config?.languageOptions?.globals).toMatchObject({ process: false, window: false });
  });

  it.each([
    { name: "skips build output", file: "dist/index.js", ignored: true },
    { name: "skips dot directories", file: ".svelte-kit/types.ts", ignored: true },
    { name: "skips the consumer's ignores", file: "coverage/index.ts", ignored: true },
    { name: "skips the .gitignore patterns", file: "node_modules/a/index.ts", ignored: true },
    { name: "lints the sources", file: "src/index.ts", ignored: false },
  ])("$name", async ({ file, ignored }) => {
    const options = { ignores: ["coverage/**"], gitIgnorePath: path.join(process.cwd(), ".gitignore") };
    expect((await effectiveConfig(options, file)) === undefined).toBe(ignored);
  });
});
