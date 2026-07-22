import { matchHeaders } from "./headers";

import { describe, expect, it } from "vitest";

const request = (headers: Record<string, string>) => new Request("https://example.com", { headers });

describe("matchHeaders", () => {
  it("matches when every expected header is present with an equal value", async () => {
    const got = await matchHeaders(
      request({ authorization: "Bearer token", "x-trace": "abc" }),
      new Headers({ authorization: "Bearer token", "x-trace": "abc" })
    );

    expect(got).toBe(true);
  });

  // The three rejection cases below are the ones that pass vacuously when the matcher iterates the
  // Headers instance with Object.entries: the loop body never runs, so it can only ever return true.
  it("rejects a header whose value differs", async () => {
    const got = await matchHeaders(
      request({ authorization: "Bearer wrong" }),
      new Headers({ authorization: "Bearer token" })
    );

    expect(got).toBe(false);
  });

  it("rejects a request missing an expected header entirely", async () => {
    const got = await matchHeaders(request({ "x-trace": "abc" }), new Headers({ authorization: "Bearer token" }));

    expect(got).toBe(false);
  });

  it("rejects when only some of the expected headers match", async () => {
    const got = await matchHeaders(
      request({ authorization: "Bearer token", "x-trace": "wrong" }),
      new Headers({ authorization: "Bearer token", "x-trace": "abc" })
    );

    expect(got).toBe(false);
  });

  it("ignores headers present only on the request", async () => {
    const got = await matchHeaders(
      request({ authorization: "Bearer token", "x-extra": "ignored" }),
      new Headers({ authorization: "Bearer token" })
    );

    expect(got).toBe(true);
  });

  // Headers lowercases its keys on both sides, so an expectation written in any casing still resolves.
  it("compares header names case-insensitively", async () => {
    const got = await matchHeaders(
      request({ authorization: "Bearer token" }),
      new Headers({ AUTHORIZATION: "Bearer token" })
    );

    expect(got).toBe(true);
  });

  it("defers to a predicate and forwards the request headers", async () => {
    const got = await matchHeaders(
      request({ authorization: "Bearer token" }),
      async (req) => req.get("authorization") === "Bearer token"
    );

    expect(got).toBe(true);
  });

  it("returns the predicate's rejection", async () => {
    const got = await matchHeaders(
      request({ authorization: "Bearer wrong" }),
      async (req) => req.get("authorization") === "Bearer token"
    );

    expect(got).toBe(false);
  });
});
