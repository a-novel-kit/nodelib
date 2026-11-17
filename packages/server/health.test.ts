import { type HealthServiceConfig, aggregateHealth } from "./health";

import { describe, expect, it, vi } from "vitest";

const authentication: HealthServiceConfig = { timeoutMs: 500, url: "http://authentication:8080/healthcheck" };

describe("aggregateHealth", () => {
  it("resolves private service configuration inside the health boundary", async () => {
    const dependencies = {
      "api:jsonKeys": { status: "up" as const },
      "client:postgres": { status: "up" as const },
      "client:smtp": { status: "up" as const },
    };
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async () => Response.json(dependencies));

    const health = await aggregateHealth({
      config: { authentication: () => authentication },
      fetch: fetchImplementation,
    });

    expect(health).toEqual({
      services: {
        authentication: {
          dependencies,
          status: "up",
        },
      },
      status: "up",
    });
    expect(fetchImplementation).toHaveBeenCalledWith(new URL(authentication.url), {
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
  });

  it("sends a probe through its service's own fetch", async () => {
    const shared = vi.fn<typeof globalThis.fetch>(async () => Response.json({}));
    const own = vi.fn<typeof globalThis.fetch>(async () => Response.json({}));

    await aggregateHealth({
      config: {
        authentication: () => ({ ...authentication, fetch: own }),
        jsonKeys: () => ({ timeoutMs: 500, url: "http://json-keys:8080/healthcheck" }),
      },
      fetch: shared,
    });

    expect(own).toHaveBeenCalledExactlyOnceWith(new URL(authentication.url), expect.anything());
    expect(shared).toHaveBeenCalledExactlyOnceWith(new URL("http://json-keys:8080/healthcheck"), expect.anything());
  });

  it.each([
    {
      name: "a configuration that throws",
      authentication: () => {
        throw new Error("private configuration detail");
      },
    },
    { name: "an invalid deadline", authentication: () => ({ ...authentication, timeoutMs: 0 }) },
  ])("reports every service down, and sends nothing, on $name", async ({ authentication }) => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>();

    const health = await aggregateHealth({
      config: {
        authentication,
        jsonKeys: () => ({ timeoutMs: 500, url: "http://json-keys:8080/healthcheck" }),
      },
      fetch: fetchImplementation,
    });

    expect(health).toEqual({
      services: {
        authentication: { status: "down" },
        jsonKeys: { status: "down" },
      },
      status: "down",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("keeps service reachability distinct from a down dependency", async () => {
    const dependencies = {
      "client:postgres": { status: "down" as const, observedAt: "service-owned-field" },
      "client:smtp": { status: "up" as const },
    };
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async () => Response.json(dependencies));

    const health = await aggregateHealth({
      config: { authentication: () => authentication },
      fetch: fetchImplementation,
    });

    expect(health).toEqual({
      services: {
        authentication: {
          dependencies,
          status: "up",
        },
      },
      status: "down",
    });
  });

  it.each([
    ["network failure", async () => Promise.reject(new Error("private connection detail"))],
    ["non-success response", async () => Response.json({ "client:postgres": { status: "up" } }, { status: 503 })],
    ["invalid contract", async () => Response.json({ "client:postgres": { state: "healthy" } })],
  ])("reports an unavailable service without fabricated dependencies for %s", async (_name, request) => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(request);

    await expect(
      aggregateHealth({ config: { authentication: () => authentication }, fetch: fetchImplementation })
    ).resolves.toEqual({
      services: {
        authentication: { status: "down" },
      },
      status: "down",
    });
  });

  it("releases the body of a non-success response", async () => {
    const failure = Response.json({ "client:postgres": { status: "up" } }, { status: 503 });

    await aggregateHealth({ config: { authentication: () => authentication }, fetch: async () => failure });
    expect(failure.bodyUsed).toBe(true);
  });
});
