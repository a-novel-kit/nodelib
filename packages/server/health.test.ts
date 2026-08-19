import { aggregateHealth } from "./health";

import { describe, expect, it, vi } from "vitest";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

const services = {
  authentication: {
    url: "http://authentication:8080/healthcheck",
  },
};

describe("aggregateHealth", () => {
  it("resolves private service configuration inside the health boundary", async () => {
    const dependencies = {
      "api:jsonKeys": { status: "up" as const },
      "client:postgres": { status: "up" as const },
      "client:smtp": { status: "up" as const },
    };
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async () => response(dependencies));

    const health = await aggregateHealth({
      config: {
        authentication: () => ({
          timeoutMs: 500,
          url: services.authentication.url,
        }),
      },
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
    expect(fetchImplementation).toHaveBeenCalledWith(new URL(services.authentication.url), {
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
  });

  it("derives a stable down response from config keys when private configuration fails", async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>();

    const health = await aggregateHealth({
      config: {
        authentication: () => {
          throw new Error("private configuration detail");
        },
        jsonKeys: () => ({
          timeoutMs: 500,
          url: "http://json-keys:8080/healthcheck",
        }),
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
    expect(health.services.jsonKeys.status).toBe("down");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("keeps service reachability distinct from a down dependency", async () => {
    const dependencies = {
      "client:postgres": { status: "down" as const, observedAt: "service-owned-field" },
      "client:smtp": { status: "up" as const },
    };
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async () => response(dependencies));

    const health = await aggregateHealth({ fetch: fetchImplementation, services, timeoutMs: 500 });

    expect(health).toEqual({
      services: {
        authentication: {
          dependencies,
          status: "up",
        },
      },
      status: "down",
    });
    expect(health.services.authentication.status).toBe("up");
  });

  it.each([
    ["network failure", async () => Promise.reject(new Error("private connection detail"))],
    ["non-success response", async () => response({ "client:postgres": { status: "up" } }, 503)],
    ["invalid contract", async () => response({ "client:postgres": { state: "healthy" } })],
  ])("reports an unavailable service without fabricated dependencies for %s", async (_name, request) => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(request);

    await expect(aggregateHealth({ fetch: fetchImplementation, services, timeoutMs: 500 })).resolves.toEqual({
      services: {
        authentication: { status: "down" },
      },
      status: "down",
    });
  });

  it("rejects an invalid deadline before sending requests for an eager registry", async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>();

    await expect(aggregateHealth({ fetch: fetchImplementation, services, timeoutMs: 0 })).rejects.toThrow(RangeError);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
