import { fileURLToPath } from "node:url";

import { type ViteUserConfig, defineConfig, defineProject } from "vitest/config";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { sveltekit } from "@sveltejs/kit/vite";
import { playwright } from "@vitest/browser-playwright";

/** Defines product paths and commands layered over the shared SvelteKit test matrix. */
export interface SvelteKitVitestOptions {
  /** URL of the consuming Vitest configuration file, normally `import.meta.url`. */
  rootUrl: string | URL;
  /** Source globs included in unit-test coverage. */
  coverageInclude?: readonly string[];
  /** Unit-test source globs. */
  unitInclude?: readonly string[];
  /** Unit-test exclusions, including files owned by the browser project. */
  unitExclude?: readonly string[];
  /** Browser component-test source globs. */
  browserInclude?: readonly string[];
  /** Storybook configuration directory resolved by the Vitest addon. */
  storybookConfigDirectory?: string;
  /** Command that starts Storybook for interaction tests. */
  storybookScript?: string;
  /** Existing Storybook URL used by CI or a local test process. */
  storybookUrl?: string;
}

/** Builds the standard unit, browser-component, and Storybook Vitest projects for a SvelteKit app. */
export function SvelteKitVitest(options: SvelteKitVitestOptions): ViteUserConfig {
  const rootUrl = typeof options.rootUrl === "string" ? new URL(options.rootUrl) : options.rootUrl;
  const storybookConfigDirectory = options.storybookConfigDirectory ?? fileURLToPath(new URL("./.storybook", rootUrl));

  return defineConfig({
    test: {
      coverage: {
        clean: true,
        enabled: true,
        include: [...(options.coverageInclude ?? ["src/**/*.{svelte,ts}"])],
        provider: "v8",
        reporter: ["text", "json", "lcov"],
        reportsDirectory: "coverage",
      },
      expect: {
        requireAssertions: true,
      },
      projects: [
        defineProject({
          plugins: [sveltekit()],
          test: {
            name: "unit",
            environment: "node",
            include: [...(options.unitInclude ?? ["src/**/*.test.ts", "scripts/**/*.test.ts"])],
            exclude: [...(options.unitExclude ?? ["src/**/*.svelte.test.ts"])],
          },
        }),
        defineProject({
          plugins: [sveltekit()],
          test: {
            name: "browser",
            include: [...(options.browserInclude ?? ["src/**/*.svelte.test.ts"])],
            browser: {
              enabled: true,
              headless: true,
              instances: [{ browser: "chromium" }],
              provider: playwright({}),
            },
          },
        }),
        defineProject({
          plugins: [
            sveltekit(),
            storybookTest({
              configDir: storybookConfigDirectory,
              storybookScript: options.storybookScript ?? "pnpm storybook",
              storybookUrl: options.storybookUrl ?? process.env.SB_URL,
            }),
          ],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              headless: true,
              instances: [{ browser: "chromium" }],
              provider: playwright({}),
            },
          },
        }),
      ],
    },
  });
}
