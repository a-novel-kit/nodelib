// @vitest-environment node
import { callerFetch, serviceToken, serviceTokenSetup } from "./service-token";

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

/** Stubs the issuer and the services: the issuer signs `<subject>@<audience>`, every other request answers 204. */
function stubNetwork() {
  const network = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    if (url.port !== "14101") return new Response(null, { status: 204 });
    return new Response(`${url.searchParams.get("subject")}@${url.searchParams.get("audience")}`);
  });
  vi.stubGlobal("fetch", network);
  return network;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("serviceToken", () => {
  it("draws a token for a caller and an audience from the local issuer", async () => {
    stubNetwork();
    await expect(serviceToken("system:serviceaccount:studio:web", "profile")).resolves.toBe(
      "system:serviceaccount:studio:web@profile"
    );
  });

  it("fails with the issuer's answer", async () => {
    vi.stubGlobal("fetch", async () => new Response("unknown subject", { status: 400 }));
    await expect(serviceToken("nobody")).rejects.toThrow("The service-token issuer answered 400: unknown subject");
  });
});

describe("callerFetch", () => {
  it("proves the caller on every request, keeping the caller's own headers", async () => {
    const network = stubNetwork();

    await callerFetch("system:serviceaccount:account:web")("http://127.0.0.1:14100/v2/session", {
      headers: { Authorization: "Bearer user" },
    });

    const headers = new Headers(network.mock.lastCall?.[1]?.headers);
    expect(headers.get("X-Service-Authorization")).toBe("system:serviceaccount:account:web@authentication");
    expect(headers.get("Authorization")).toBe("Bearer user");
  });
});

describe("serviceTokenSetup", () => {
  it("writes each token file, and removes them on teardown", async () => {
    stubNetwork();
    const directory = await mkdtemp(join(tmpdir(), "service-token-"));
    const subject = "system:serviceaccount:studio:web";
    const authentication = join(directory, "nested", "service-token");
    const profile = join(directory, "profile-service-token");

    try {
      const teardown = await serviceTokenSetup([
        { path: authentication, subject },
        { path: profile, subject, audience: "profile" },
      ])();

      await expect(readFile(authentication, "utf8")).resolves.toBe(`${subject}@authentication`);
      await expect(readFile(profile, "utf8")).resolves.toBe(`${subject}@profile`);

      await teardown();
      await expect(readFile(authentication)).rejects.toThrow("ENOENT");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
