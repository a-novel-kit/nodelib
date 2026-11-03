// @vitest-environment node
import { type JwtVerifierOptions, type PublicJwk, createJwtVerifier } from "./jwt";

import { Buffer } from "node:buffer";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const now = new Date("2026-11-04T12:00:00Z").getTime();
const seconds = now / 1000;

const target = { issuer: "anovel-authentication", audience: "anovel-client", subject: "user-access" };
const claims = { iss: target.issuer, aud: target.audience, sub: target.subject, exp: seconds + 900, userID: "u1" };

interface SigningKey {
  privateKey: CryptoKey;
  jwk: PublicJwk;
}

async function generateKey(kid: string): Promise<SigningKey> {
  const pair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid, alg: "Ed25519", use: "sig" };

  return { privateKey: pair.privateKey, jwk };
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function sign(key: SigningKey, payload: object, header: object = {}): Promise<string> {
  const signed = `${encode({ alg: "Ed25519", typ: "JWT", kid: key.jwk.kid, ...header })}.${encode(payload)}`;
  const signature = await crypto.subtle.sign("Ed25519", key.privateKey, new TextEncoder().encode(signed));

  return `${signed}.${Buffer.from(signature).toString("base64url")}`;
}

function verifier(fetchKeys: JwtVerifierOptions["fetchKeys"], options: Partial<JwtVerifierOptions> = {}) {
  return createJwtVerifier({ ...target, fetchKeys, leewayMs: 300_000, cacheMs: 1_800_000, ...options });
}

let current: SigningKey;
let other: SigningKey;

beforeAll(async () => {
  [current, other] = await Promise.all([generateKey("current"), generateKey("other")]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createJwtVerifier", () => {
  it.each([
    { name: "a valid token", payload: claims },
    { name: "a token within the leeway past its expiry", payload: { ...claims, exp: seconds - 299 } },
    { name: "a token within the leeway before its start", payload: { ...claims, nbf: seconds + 299 } },
    { name: "a token among several audiences", payload: { ...claims, aud: ["another", target.audience] } },
  ])("accepts $name", async ({ payload }) => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const verify = verifier(async () => [current.jwk]);

    await expect(verify(await sign(current, payload))).resolves.toEqual(payload);
  });

  it("accepts the legacy EdDSA label", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const verify = verifier(async () => [current.jwk]);

    await expect(verify(await sign(current, claims, { alg: "EdDSA" }))).resolves.toEqual(claims);
  });

  it.each([
    { name: "an expired token", payload: { ...claims, exp: seconds - 300 } },
    { name: "a token without expiry", payload: { ...claims, exp: undefined } },
    { name: "a token not valid yet", payload: { ...claims, nbf: seconds + 301 } },
    { name: "a token with a malformed start", payload: { ...claims, nbf: "now" } },
    { name: "another issuer", payload: { ...claims, iss: "someone" } },
    { name: "another audience", payload: { ...claims, aud: "another" } },
    { name: "another subject", payload: { ...claims, sub: "user-refresh" } },
  ])("rejects $name", async ({ payload }) => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const verify = verifier(async () => [current.jwk]);

    await expect(verify(await sign(current, payload))).rejects.toThrow();
  });

  it.each([
    { name: "an unsigned token", header: { alg: "none" } },
    { name: "another algorithm", header: { alg: "ES256" } },
    { name: "critical extensions", header: { crit: ["exp"] } },
    { name: "no key ID", header: { kid: undefined } },
  ])("rejects a header with $name", async ({ header }) => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const verify = verifier(async () => [current.jwk]);

    await expect(verify(await sign(current, claims, header))).rejects.toThrow();
  });

  it("rejects a token signed by a key outside the set", async () => {
    const verify = verifier(async () => [current.jwk]);

    await expect(verify(await sign({ ...other, jwk: current.jwk }, claims))).rejects.toThrow("signature");
  });

  it("rejects a token whose payload changed after signing", async () => {
    const verify = verifier(async () => [current.jwk]);
    const [header, , signature] = (await sign(current, claims)).split(".");

    await expect(verify(`${header}.${encode({ ...claims, userID: "u2" })}.${signature}`)).rejects.toThrow("signature");
  });

  it.each([
    { name: "two parts", token: "a.b" },
    { name: "a part outside base64url", token: "a+b.c.d" },
    { name: "a header that is not an object", token: `${encode([1])}.${encode(claims)}.sig` },
    { name: "an oversized token", token: `${"a".repeat(8192)}.b.c` },
  ])("rejects a token with $name", async ({ token }) => {
    const fetchKeys = vi.fn(async () => [current.jwk]);

    await expect(verifier(fetchKeys)(token)).rejects.toThrow("malformed");
    expect(fetchKeys).not.toHaveBeenCalled();
  });

  it("skips keys that are not Ed25519", async () => {
    const verify = verifier(async () => [{ kid: current.jwk.kid, kty: "EC", crv: "P-256" }]);

    await expect(verify(await sign(current, claims))).rejects.toThrow("signature");
  });

  it("shares one fetch between concurrent callers and reuses it within the cache", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const fetchKeys = vi.fn(async () => [current.jwk]);
    const verify = verifier(fetchKeys);
    const token = await sign(current, claims);

    await Promise.all([verify(token), verify(token)]);
    await verify(token);
    expect(fetchKeys).toHaveBeenCalledTimes(1);
  });

  it("fetches again once the cache expires", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const fetchKeys = vi.fn<JwtVerifierOptions["fetchKeys"]>(async () => [current.jwk]);
    const verify = verifier(fetchKeys);

    await verify(await sign(current, claims));
    vi.setSystemTime(now + 1_800_000);
    // The issuer withdrew the key, so its tokens stop verifying.
    fetchKeys.mockResolvedValue([other.jwk]);

    await expect(verify(await sign(current, claims))).rejects.toThrow("signature");
    expect(fetchKeys).toHaveBeenCalledTimes(2);
  });

  it("fetches a key it has not seen once the set is old enough", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const fetchKeys = vi.fn<JwtVerifierOptions["fetchKeys"]>(async () => [current.jwk]);
    const verify = verifier(fetchKeys);
    await verify(await sign(current, claims));

    fetchKeys.mockResolvedValue([current.jwk, other.jwk]);
    await expect(verify(await sign(other, claims))).rejects.toThrow("signature");
    expect(fetchKeys).toHaveBeenCalledTimes(1);

    vi.setSystemTime(now + 10_000);
    await expect(verify(await sign(other, claims))).resolves.toEqual(claims);
    expect(fetchKeys).toHaveBeenCalledTimes(2);
  });

  it("keeps a stale key set while fetching fails, within its window", async () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const fetchKeys = vi.fn<JwtVerifierOptions["fetchKeys"]>(async () => [current.jwk]);
    const verify = verifier(fetchKeys, { staleIfErrorMs: 3_600_000, leewayMs: 7_200_000 });
    const token = await sign(current, claims);
    await verify(token);

    fetchKeys.mockRejectedValue(new TypeError("fetch failed"));
    vi.setSystemTime(now + 1_800_000);
    await expect(verify(token)).resolves.toEqual(claims);

    // A failed fetch waits out the retry interval before the next one.
    await expect(verify(token)).resolves.toEqual(claims);
    expect(fetchKeys).toHaveBeenCalledTimes(2);

    vi.setSystemTime(now + 5_400_000);
    await expect(verify(token)).rejects.toThrow("signature");
    expect(fetchKeys).toHaveBeenCalledTimes(3);
  });

  it("rejects every token while no key set was ever fetched", async () => {
    const verify = verifier(async () => Promise.reject(new TypeError("fetch failed")));

    await expect(verify(await sign(current, claims))).rejects.toThrow("signature");
  });
});
