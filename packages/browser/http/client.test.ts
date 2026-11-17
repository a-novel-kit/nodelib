import { type HealthDependency, RestClient, type RestInit } from "./client";
import { HttpError } from "./error";

import { afterEach, describe, expect, it, vi } from "vitest";

import { z } from "zod";

/** Builds a client whose fetcher records each request and answers with `response`. */
function client(response: () => Response) {
  const fetcher = vi.fn<typeof fetch>(async () => response());
  return { api: new RestClient("https://service.test", fetcher), fetcher };
}

/** Returns the request the fetcher received last. */
function sent(fetcher: ReturnType<typeof client>["fetcher"]) {
  const [input, init] = fetcher.mock.lastCall ?? [];
  return { url: String(input), headers: new Headers(init?.headers), body: init?.body, method: init?.method };
}

describe("RestClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<{ name: string; init: RestInit; headers: Record<string, string>; body?: string }>([
    { name: "sends the request as given", init: { method: "GET" }, headers: {} },
    {
      name: "sends the access token as a bearer token",
      init: { accessToken: "token" },
      headers: { authorization: "Bearer token" },
    },
    {
      name: "sends a JSON body with its content type",
      init: { method: "PUT", json: { name: "a" } },
      headers: { "content-type": "application/json" },
      body: `{"name":"a"}`,
    },
    {
      name: "keeps the headers the caller set beside the ones it builds",
      init: { accessToken: "token", json: [], headers: { "X-Client-IP": "192.0.2.1" } },
      headers: { authorization: "Bearer token", "content-type": "application/json", "x-client-ip": "192.0.2.1" },
      body: "[]",
    },
    {
      name: "replaces the body with the JSON one",
      init: { body: "raw", json: null },
      headers: { "content-type": "application/json" },
      body: "null",
    },
  ])("$name", async ({ init, headers, body }) => {
    const { api, fetcher } = client(() => new Response(null, { status: 204 }));

    await api.fetchVoid("/v1/resource", init);

    const request = sent(fetcher);
    expect(request.url).toBe("https://service.test/v1/resource");
    expect(Object.fromEntries(request.headers)).toEqual(expect.objectContaining(headers));
    expect([...request.headers.keys()]).toHaveLength(Object.keys(headers).length);
    expect(request.body ?? undefined).toBe(body);
    expect(request.method).toBe(init.method);
  });

  it("calls the global fetch unbound by default", async () => {
    const globalFetch = vi.fn<typeof fetch>(async () => Response.json({ status: "up" }));
    vi.stubGlobal("fetch", globalFetch);

    await expect(new RestClient("https://service.test").fetch("/v1/healthcheck")).resolves.toEqual({ status: "up" });
    expect(globalFetch).toHaveBeenCalledOnce();
    expect(globalFetch.mock.contexts[0]).toBeUndefined();
  });

  describe("fetch", () => {
    const schema = z.object({ id: z.string() });

    it("decodes the body through the schema", async () => {
      const { api } = client(() => Response.json({ id: "a", extra: true }));
      await expect(api.fetch("/v1/resource", schema)).resolves.toStrictEqual({ id: "a" });
    });

    it("trusts the body without a schema", async () => {
      const report: Record<string, HealthDependency> = { postgres: { status: "up" } };
      const { api } = client(() => Response.json(report));
      await expect(api.fetch("/v1/healthcheck")).resolves.toStrictEqual(report);
    });

    it("rejects a body the schema refuses", async () => {
      const { api } = client(() => Response.json({ id: 1 }));
      await expect(api.fetch("/v1/resource", schema)).rejects.toBeInstanceOf(z.ZodError);
    });
  });

  it("cancels the body fetchVoid discards", async () => {
    const response = new Response("pong");
    const { api } = client(() => response);

    await api.fetchVoid("/v1/ping");

    expect(response.bodyUsed).toBe(true);
  });

  it("reads the body as a typed Blob", async () => {
    const { api } = client(() => new Response("image", { headers: { "Content-Type": "image/webp" } }));

    const blob = await api.fetchBlob("/v1/picture");

    expect(blob.type).toBe("image/webp");
    await expect(blob.text()).resolves.toBe("image");
  });

  it.each([
    { name: "fetchVoid", call: (api: RestClient) => api.fetchVoid("/v1/resource") },
    { name: "fetch", call: (api: RestClient) => api.fetch("/v1/resource") },
    { name: "fetchBlob", call: (api: RestClient) => api.fetchBlob("/v1/resource") },
  ])("$name throws an HttpError on a non-2xx status", async ({ call }) => {
    const { api } = client(() => new Response("missing", { status: 404 }));
    await expect(call(api)).rejects.toThrowError(new HttpError(404, "missing"));
  });

  it("leaves the status of fetchResponse to its caller", async () => {
    const { api } = client(() => new Response("refused", { status: 400 }));

    const response = await api.fetchResponse("/v1/token");

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("refused");
  });
});
