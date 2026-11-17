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
    const customRules = {
      languageOptions: { parserOptions: { projectService: false } },
      rules: { eqeqeq: "error" as const },
    };
    const config = await effectiveConfig({ customRules }, "src/index.ts");

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
    // The consumer's language options join the default globals rather than replacing them.
    expect(config?.languageOptions?.globals).toMatchObject({ process: false, window: false });
    expect(config?.languageOptions?.parserOptions).toMatchObject({ projectService: false });
  });

  // Each row ignores a path through one source alone, and lints it once that source is absent.
  const gitIgnorePath = path.join(process.cwd(), ".gitignore");
  it.each<{ name: string; options: EslintOptions; file: string; ignored: boolean }>([
    { name: "skips build output", options: {}, file: "dist/index.js", ignored: true },
    { name: "skips dot directories", options: {}, file: ".svelte-kit/types.ts", ignored: true },
    {
      name: "skips the consumer's ignores",
      options: { ignores: ["generated/**"] },
      file: "generated/index.ts",
      ignored: true,
    },
    { name: "skips the .gitignore patterns", options: { gitIgnorePath }, file: "coverage/index.ts", ignored: true },
    { name: "lints a path no consumer ignore names", options: {}, file: "generated/index.ts", ignored: false },
    { name: "lints a path no .gitignore names", options: {}, file: "coverage/index.ts", ignored: false },
  ])("$name", async ({ options, file, ignored }) => {
    expect((await effectiveConfig(options, file)) === undefined).toBe(ignored);
  });
});
