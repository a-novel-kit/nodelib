import { SvelteKitVitest } from "./vitest-sveltekit";

import { describe, expect, it, vi } from "vitest";

vi.mock("@storybook/addon-vitest/vitest-plugin", () => ({
  storybookTest: () => ({ name: "storybook-test" }),
}));

describe("SvelteKitVitest", () => {
  it("builds the standard project matrix from consumer policy", () => {
    const config = SvelteKitVitest({
      rootUrl: import.meta.url,
      coverageInclude: ["app/**/*.ts"],
    });

    expect(config.test?.coverage?.include).toEqual(["app/**/*.ts"]);
    expect(config.test?.projects).toHaveLength(3);
    expect(config.test?.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ test: expect.objectContaining({ name: "unit" }) }),
        expect.objectContaining({ test: expect.objectContaining({ name: "browser" }) }),
        expect.objectContaining({ test: expect.objectContaining({ name: "storybook" }) }),
      ])
    );
  });
});
