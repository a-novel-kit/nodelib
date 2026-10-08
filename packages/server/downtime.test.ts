import { createDowntimeReader, isDowntimeStarted } from "./downtime";

import { afterEach, describe, expect, it, vi } from "vitest";

const url = "https://raw.githubusercontent.com/a-novel/infra/downtime/downtime.json";

const document = {
  components: ["service-json-keys.database"],
  start: "2026-10-12T06:00:00Z",
  end: "2026-10-12T07:00:00Z",
};

const downtime = {
  components: ["service-json-keys.database"],
  start: new Date("2026-10-12T06:00:00Z"),
  end: new Date("2026-10-12T07:00:00Z"),
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("createDowntimeReader", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { name: "reads a planned downtime", body: document, expected: downtime },
    { name: "reads that none is planned", body: null, expected: null },
  ])("$name", async ({ body, expected }) => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async () => response(body));

    await expect(createDowntimeReader({ url, fetch: fetchImplementation })()).resolves.toEqual(expected);
    expect(fetchImplementation).toHaveBeenCalledWith(new URL(url), {
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    { name: "a request that fails", fetch: async () => Promise.reject(new TypeError("fetch failed")) },
    { name: "an error status", fetch: async () => response("not found", 404) },
    { name: "a malformed document", fetch: async () => response({ ...document, start: "soon" }) },
    {
      name: "a document without components",
      fetch: async () => response({ start: document.start, end: document.end }),
    },
  ])("keeps the last known downtime after $name", async ({ fetch }) => {
    const fetchImplementation = vi
      .fn<typeof globalThis.fetch>(fetch)
      .mockImplementationOnce(async () => response(document));
    const read = createDowntimeReader({ url, fetch: fetchImplementation, ttlMs: 0 });

    await expect(read()).resolves.toEqual(downtime);
    await expect(read()).resolves.toEqual(downtime);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("resolves to null before any read succeeds", async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async () =>
      Promise.reject(new TypeError("fetch failed"))
    );

    await expect(createDowntimeReader({ url, fetch: fetchImplementation })()).resolves.toBeNull();
  });

  it("reuses a read until it expires", async () => {
    vi.useFakeTimers();
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async () => response(document));
    const read = createDowntimeReader({ url, fetch: fetchImplementation, ttlMs: 60_000 });

    await read();
    vi.advanceTimersByTime(59_999);
    await read();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await read();
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("shares one request between concurrent reads", async () => {
    const fetchImplementation = vi.fn<typeof globalThis.fetch>(async () => response(document));
    const read = createDowntimeReader({ url, fetch: fetchImplementation });

    await expect(Promise.all([read(), read()])).resolves.toEqual([downtime, downtime]);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});

describe("isDowntimeStarted", () => {
  it.each([
    { name: "none is planned", downtime: null, now: downtime.start, expected: false },
    { name: "before the start", downtime, now: new Date("2026-10-12T05:59:59Z"), expected: false },
    { name: "at the start", downtime, now: downtime.start, expected: true },
    // Only clearing ends a downtime, whatever end was announced.
    { name: "long past the end", downtime, now: new Date("2026-11-12T00:00:00Z"), expected: true },
  ])("returns $expected when $name", ({ downtime, now, expected }) => {
    expect(isDowntimeStarted(downtime, now)).toBe(expected);
  });
});
