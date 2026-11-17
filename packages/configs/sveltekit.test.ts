import { SvelteKitVite } from "./sveltekit";

import type { Plugin } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.stubEnv("ORIGIN", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
      paths: { base: "/studio", origin: undefined },
      tracing: { server: true },
    });
  });

  it("preserves an explicit deployment adapter", () => {
    const adapter = {
      name: "consumer-adapter",
      adapt: async () => undefined,
    } satisfies Adapter;

    SvelteKitVite({}, { adapter });

    expect(mocks.sveltekit).toHaveBeenCalledWith(expect.objectContaining({ adapter }));
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

  it.each([
    { name: "trusts ORIGIN for a build at a known address", origin: "http://127.0.0.1:4173", kit: {}, paths: {} },
    {
      name: "lets an application choose its origin and tracing",
      origin: "http://127.0.0.1:4173",
      kit: { paths: { origin: "https://studio.test" }, tracing: { server: false } },
      paths: { origin: "https://studio.test" },
    },
  ])("$name", ({ origin, kit, paths }) => {
    vi.stubEnv("ORIGIN", origin);

    SvelteKitVite({}, kit);

    expect(mocks.sveltekit).toHaveBeenCalledWith(
      expect.objectContaining({ paths: { origin, ...paths }, tracing: { server: true, ...kit.tracing } })
    );
  });
});
