import { SvelteKit, SvelteKitVite } from "./sveltekit";

import { describe, expect, it } from "vitest";

describe("SvelteKit", () => {
  it("provides the Node adapter while preserving application policy", () => {
    const config = SvelteKit({
      kit: {
        paths: {
          base: "/studio",
        },
      },
    });

    expect(config.kit?.adapter).toBeDefined();
    expect(config.kit?.paths?.base).toBe("/studio");
  });
});

describe("SvelteKitVite", () => {
  it("preserves application configuration", () => {
    const config = SvelteKitVite({
      build: {
        sourcemap: true,
      },
    });

    expect(config.build?.sourcemap).toBe(true);
    expect(config.plugins).toHaveLength(1);
  });
});
