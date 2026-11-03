import { SvelteKitVite } from "./sveltekit";

import type { Plugin } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Adapter } from "@sveltejs/kit";

const mocks = vi.hoisted(() => ({
  sveltekit: vi.fn(() => ({ name: "sveltekit" })),
}));

vi.mock("@sveltejs/kit/vite", () => ({
  sveltekit: mocks.sveltekit,
}));

const defaultDirectives = {
  "script-src": ["self"],
  "object-src": ["none"],
  "base-uri": ["none"],
  "frame-ancestors": ["none"],
};

describe("SvelteKitVite", () => {
  beforeEach(() => {
    mocks.sveltekit.mockClear();
  });

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
    expect(config.plugins?.[0]).toEqual({ name: "sveltekit" });
    expect(config.plugins?.[1]).toBe(plugin);
  });

  it("provides the Node adapter while preserving application policy", () => {
    SvelteKitVite({}, { paths: { base: "/studio" } });

    expect(mocks.sveltekit).toHaveBeenCalledWith({
      adapter: expect.objectContaining({ name: "@sveltejs/adapter-node" }),
      csp: { mode: "auto", directives: defaultDirectives },
      paths: { base: "/studio" },
    });
  });

  it("preserves an explicit deployment adapter", () => {
    const adapter = {
      name: "consumer-adapter",
      adapt: async () => undefined,
    } satisfies Adapter;

    SvelteKitVite({}, { adapter });

    expect(mocks.sveltekit).toHaveBeenCalledWith({ adapter, csp: { mode: "auto", directives: defaultDirectives } });
  });

  it("lets an application add a directive, replace one, and choose the mode", () => {
    SvelteKitVite(
      {},
      {
        csp: {
          mode: "nonce",
          directives: { "connect-src": ["self"], "frame-ancestors": ["self"] },
          reportOnly: { "default-src": ["self"] },
        },
      }
    );

    expect(mocks.sveltekit).toHaveBeenCalledWith(
      expect.objectContaining({
        csp: {
          mode: "nonce",
          directives: { ...defaultDirectives, "connect-src": ["self"], "frame-ancestors": ["self"] },
          reportOnly: { "default-src": ["self"] },
        },
      })
    );
  });
});
