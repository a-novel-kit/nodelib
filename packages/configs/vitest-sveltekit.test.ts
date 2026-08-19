import { SvelteKitVitest } from "./vitest-sveltekit";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storybookTest: vi.fn(() => ({ name: "storybook-test" })),
}));

vi.mock("@storybook/addon-vitest/vitest-plugin", () => ({
  storybookTest: mocks.storybookTest,
}));

describe("SvelteKitVitest", () => {
  beforeEach(() => {
    mocks.storybookTest.mockClear();
  });

  it("builds the standard project matrix from consumer policy", () => {
    const vitePlugins = vi.fn(() => [{ name: "consumer-yaml" }]);
    const config = SvelteKitVitest({
      rootUrl: new URL(import.meta.url),
      coverageInclude: ["app/**/*.ts"],
      unitInclude: ["app/**/*.test.ts"],
      unitExclude: ["app/**/*.svelte.test.ts"],
      browserInclude: ["app/**/*.svelte.test.ts"],
      storybookConfigDirectory: "/workspace/.storybook",
      storybookScript: "pnpm storybook:test",
      storybookUrl: "http://127.0.0.1:6006",
      vitePlugins,
    });

    expect(config.test?.coverage?.include).toEqual(["app/**/*.ts"]);
    expect(config.test?.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          test: expect.objectContaining({
            name: "unit",
            include: ["app/**/*.test.ts"],
            exclude: ["app/**/*.svelte.test.ts"],
          }),
        }),
        expect.objectContaining({
          test: expect.objectContaining({ name: "browser", include: ["app/**/*.svelte.test.ts"] }),
        }),
        expect.objectContaining({ test: expect.objectContaining({ name: "storybook" }) }),
      ])
    );
    for (const project of config.test?.projects ?? []) {
      expect(project).toEqual(
        expect.objectContaining({
          plugins: expect.arrayContaining([expect.objectContaining({ name: "consumer-yaml" })]),
        })
      );
    }
    expect(vitePlugins).toHaveBeenCalledTimes(3);
    expect(mocks.storybookTest).toHaveBeenCalledWith({
      configDir: "/workspace/.storybook",
      storybookScript: "pnpm storybook:test",
      storybookUrl: "http://127.0.0.1:6006",
    });
  });

  it("provides shareable defaults from a config URL", () => {
    vi.stubEnv("SB_URL", "http://storybook.internal");

    const config = SvelteKitVitest({ rootUrl: import.meta.url });

    expect(config.test?.coverage?.include).toEqual(["src/**/*.{svelte,ts}"]);
    expect(config.test?.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          test: expect.objectContaining({
            name: "unit",
            include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
            exclude: ["src/**/*.svelte.test.ts"],
          }),
        }),
        expect.objectContaining({
          test: expect.objectContaining({ name: "browser", include: ["src/**/*.svelte.test.ts"] }),
        }),
      ])
    );
    expect(mocks.storybookTest).toHaveBeenCalledWith({
      configDir: expect.stringMatching(/packages\/configs\/\.storybook$/),
      storybookScript: "pnpm storybook",
      storybookUrl: "http://storybook.internal",
    });

    vi.unstubAllEnvs();
  });
});
