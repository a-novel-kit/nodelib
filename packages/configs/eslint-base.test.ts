import { Eslint } from "./eslint-base";

import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ConfigWithExtends } from "@eslint/config-helpers";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import ts from "typescript-eslint";

function configsFor(options: Parameters<typeof Eslint>[0] = {}): ConfigWithExtends[] {
  return Eslint(options) as ConfigWithExtends[];
}

describe("Eslint", () => {
  it("layers ignores and consumer rules over the language defaults", () => {
    const configs = configsFor({
      ignores: ["coverage/**"],
      gitIgnorePath: path.join(process.cwd(), ".gitignore"),
      customRules: {
        languageOptions: {
          parserOptions: {
            projectService: false,
          },
        },
        rules: {
          eqeqeq: "error",
        },
      },
    });

    expect(configs[0]).toMatchObject({ ignores: ["**/dist/**", "**/.*/**", "coverage/**"] });
    expect(configs[1]).toMatchObject({
      name: "Imported .gitignore patterns",
      ignores: expect.arrayContaining(["**/node_modules", "**/coverage"]),
    });

    const consumerRules = configs.find((config) => config.rules?.eqeqeq === "error");
    expect(consumerRules).toMatchObject({
      languageOptions: {
        globals: expect.objectContaining({ process: false, window: false }),
        parserOptions: { projectService: false },
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        eqeqeq: "error",
      },
    });
  });

  it("orders the language presets, the default rules block, then Prettier's block", () => {
    expect(configsFor()).toEqual([
      expect.objectContaining({ ignores: ["**/dist/**", "**/.*/**"] }),
      js.configs.recommended,
      ...ts.configs.recommended,
      expect.objectContaining({ rules: expect.objectContaining({ "@typescript-eslint/no-explicit-any": "off" }) }),
      prettier,
    ]);
  });
});
