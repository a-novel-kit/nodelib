import { fileURLToPath } from "node:url";

import type { PluginOption } from "vite";
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
  /** Source globs left out of coverage: by default stories, story harnesses, fixtures and the Storybook i18n setup. */
  coverageExclude?: readonly string[];
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
  /** Additional Vite plugins constructed independently for each Vitest project. */
  vitePlugins?: () => readonly PluginOption[];
  /**
   * Dependencies every project optimizes before its first test, such as a service client and Zod. A
   * dependency Vite discovers mid-run reloads the browser, which fails the tests in flight.
   */
  optimizeDepsInclude?: readonly string[];
}

/** The files only Storybook and tests run, which coverage leaves out by default. */
const coverageExclude = [
  "src/**/*.stories.{svelte,ts}",
  "src/**/story.svelte",
  "src/**/*.fixture.ts",
  "src/lib/i18n/storybook.ts",
];

/** Builds the browser options that run one project's tests in headless Chromium, with a provider of its own. */
function headlessChromium() {
  return {
    enabled: true,
    headless: true,
    instances: [{ browser: "chromium" as const }],
    provider: playwright({}),
  };
}

/**
 * Builds the standard unit, browser-component, and Storybook Vitest projects for a SvelteKit app.
 * Unit tests run offline: the global `fetch` rejects every request a test does not stub.
 */
export function SvelteKitVitest(options: SvelteKitVitestOptions): ViteUserConfig {
  const storybookConfigDirectory =
    options.storybookConfigDirectory ?? fileURLToPath(new URL("./.storybook", options.rootUrl));
  const plugins = (): PluginOption[] => [sveltekit(), ...(options.vitePlugins?.() ?? [])];
  const optimizeDeps = { include: [...(options.optimizeDepsInclude ?? [])] };

  return defineConfig({
    test: {
      coverage: {
        clean: true,
        enabled: true,
        include: [...(options.coverageInclude ?? ["src/**/*.{svelte,ts}"])],
        exclude: [...(options.coverageExclude ?? coverageExclude)],
        provider: "v8",
        reporter: ["text", "json", "lcov"],
        reportsDirectory: "coverage",
      },
      expect: {
        requireAssertions: true,
      },
      projects: [
        defineProject({
          plugins: plugins(),
          optimizeDeps,
          test: {
            name: "unit",
            environment: "node",
            include: [...(options.unitInclude ?? ["src/**/*.test.ts", "scripts/**/*.test.ts"])],
            exclude: [...(options.unitExclude ?? ["src/**/*.svelte.test.ts"])],
            setupFiles: ["@a-novel-kit/nodelib-config/vitest-offline"],
          },
        }),
        defineProject({
          plugins: plugins(),
          optimizeDeps,
          test: {
            name: "browser",
            include: [...(options.browserInclude ?? ["src/**/*.svelte.test.ts"])],
            browser: headlessChromium(),
          },
        }),
        defineProject({
          plugins: [
            ...plugins(),
            storybookTest({
              configDir: storybookConfigDirectory,
              storybookScript: options.storybookScript ?? "pnpm storybook",
              storybookUrl: options.storybookUrl ?? process.env.SB_URL,
            }),
          ],
          optimizeDeps,
          test: {
            name: "storybook",
            browser: headlessChromium(),
          },
        }),
      ],
    },
  });
}
