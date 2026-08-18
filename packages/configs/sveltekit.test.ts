import { SvelteKit, SvelteKitVite } from "./sveltekit";

import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";

import type { Adapter } from "@sveltejs/kit";

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

  it("preserves an explicit deployment adapter", () => {
    const adapter = {
      name: "consumer-adapter",
      adapt: async () => undefined,
    } satisfies Adapter;

    expect(SvelteKit({ kit: { adapter } }).kit?.adapter).toBe(adapter);
  });
});

describe("SvelteKitVite", () => {
  it("preserves application configuration", () => {
    const plugin = { name: "consumer-plugin" } satisfies Plugin;
    const config = SvelteKitVite({
      build: {
        sourcemap: true,
      },
      plugins: [plugin],
    });

    expect(config.build?.sourcemap).toBe(true);
    expect(config.plugins).toHaveLength(2);
    expect(config.plugins?.[1]).toBe(plugin);
  });
});
