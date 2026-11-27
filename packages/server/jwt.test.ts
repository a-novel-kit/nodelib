// @vitest-environment node
import {
  type ApiKeyVerifierOptions,
  type JwtPayload,
  type JwtVerifierOptions,
  type PublicJwk,
  createJwtVerifier,
  createProofSigner,
  createRequestTokenSigner,
  jwkThumbprint,
  verifyProof,
  verifyRequestToken,
} from "./jwt";

import { Buffer } from "node:buffer";
import { KeyObject, createPublicKey, generateKeyPairSync, verify } from "node:crypto";

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

describe("API key tokens", () => {
  const purpose = "publish-package";
  // The SHA-256 of the UTF-8 bytes of the body, as `sha256sum` prints it.
  const body = '{"title":"Café"}';
  const bodySHA256 = "97abf59ac9ce42d34f62d32f6b75eb18a16cedc16ef9de9c818e902a93c51e5f";
  const otherBodySHA256 = "a1358dc1772b00bf3f1f72f339ae14506ceb8732b2fefd13f461ec85ef29b464";
  const proofHeader = { typ: "proof+jwt" };

  // The private half of `current`, as the holder of an API key keeps it.
  let privateKey: string;
  let options: ApiKeyVerifierOptions;

  beforeAll(() => {
    privateKey = KeyObject.from(current.privateKey).export({ format: "pem", type: "pkcs8" }).toString();
    options = { publicKey: current.jwk, purpose };
  });

  /** Verifies a token as a verifier outside this module does, and returns what it holds. */
  function readToken(token: string) {
    const [header = "", payload = "", signature = ""] = token.split(".");
    const publicKey = createPublicKey(privateKey);
    if (!verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"))) {
      throw new Error("signature invalid");
    }

    const decode = (part: string): unknown => JSON.parse(Buffer.from(part, "base64url").toString());
    return { header: decode(header), payload: decode(payload) };
  }

  describe("jwkThumbprint", () => {
    it("hashes the public members of an Ed25519 key", () => {
      // The example of RFC 8037, appendix A.3.
      const key = { kty: "OKP", crv: "Ed25519", x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" };

      expect(jwkThumbprint(key)).toBe("kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k");
    });

    it.each([
      { name: "a P-256 key", key: { kty: "EC", crv: "P-256", x: "AA", y: "AA" } },
      { name: "an Ed25519 key without its public member", key: { kty: "OKP", crv: "Ed25519" } },
    ])("refuses $name", ({ key }) => {
      expect(() => jwkThumbprint(key)).toThrow(new Error("not an Ed25519 public key"));
    });
  });

  describe("createProofSigner", () => {
    it("signs the claims under the purpose and the time, naming the key by its thumbprint", () => {
      vi.useFakeTimers({ now, toFake: ["Date"] });
      const proof = createProofSigner({ privateKey, purpose })({ name: "sample", aud: "another", iat: 1 });

      expect(readToken(proof)).toEqual({
        header: { alg: "EdDSA", typ: "proof+jwt", kid: jwkThumbprint(current.jwk) },
        payload: { name: "sample", aud: purpose, iat: seconds },
      });
    });

    it("names the key by the ID it is given", () => {
      const proof = createProofSigner({ privateKey, purpose, keyID: "user-key" })({});

      expect(readToken(proof).header).toMatchObject({ kid: "user-key" });
    });

    it("refuses claims too long for a verifier to read", () => {
      expect(() => createProofSigner({ privateKey, purpose })({ note: "a".repeat(8192) })).toThrow(
        new Error("JWT too long to verify")
      );
    });

    it.each([
      { name: "an empty value", key: () => "" },
      { name: "text that is no key", key: () => "not a key" },
      { name: "a cut private key", key: () => privateKey.slice(0, 60) + privateKey.slice(70) },
      {
        name: "the public key",
        key: () => createPublicKey(privateKey).export({ format: "pem", type: "spki" }).toString(),
      },
      {
        name: "an X25519 private key",
        key: () => generateKeyPairSync("x25519").privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      },
    ])("refuses $name, without quoting it", ({ key }) => {
      expect(() => createProofSigner({ privateKey: key(), purpose })).toThrow(
        new Error("not an Ed25519 private key in PEM")
      );
    });
  });

  describe("createRequestTokenSigner", () => {
    it("signs a token for one body that the public key verifies", () => {
      vi.useFakeTimers({ now, toFake: ["Date"] });
      const signRequest = createRequestTokenSigner({ privateKey, purpose });

      expect(readToken(signRequest(body))).toEqual({
        header: { alg: "EdDSA", typ: "JWT", kid: jwkThumbprint(current.jwk) },
        payload: { aud: purpose, iat: seconds, exp: seconds + 300, bodySHA256 },
      });
    });

    it("digests the bytes of the body, whichever way they come", () => {
      const signRequest = createRequestTokenSigner({ privateKey, purpose });
      const digest = (sent: string | Uint8Array) =>
        (readToken(signRequest(sent)).payload as Record<string, unknown>).bodySHA256;

      expect(digest(new TextEncoder().encode(body))).toBe(bodySHA256);
      expect(digest('{"title":"Cafe"}')).toBe(otherBodySHA256);
    });
  });

  describe("verifyProof", () => {
    it("accepts the proof its signer made however old, and resolves to its claims", async () => {
      vi.useFakeTimers({ now, toFake: ["Date"] });
      const proof = createProofSigner({ privateKey, purpose })({ name: "sample" });
      vi.setSystemTime(now + 400 * 86_400_000);

      await expect(verifyProof(proof, options)).resolves.toEqual({ name: "sample", aud: purpose, iat: seconds });
    });

    it.each([
      { name: "another purpose", token: () => sign(current, { aud: "another" }, proofHeader), error: "another use" },
      {
        name: "a proof 30 seconds past the expiry it sets",
        token: () => sign(current, { aud: purpose, exp: seconds - 30 }, proofHeader),
        error: "expired",
      },
      {
        name: "a proof before the start it sets",
        token: () => sign(current, { aud: purpose, nbf: seconds + 31 }, proofHeader),
        error: "not valid yet",
      },
      {
        name: "a proof signed by another key",
        token: () => sign(other, { aud: purpose }, proofHeader),
        error: "signature",
      },
      {
        name: "a proof changed after signing",
        token: async () => {
          const [header, , signature] = (await sign(current, { name: "sample", aud: purpose }, proofHeader)).split(".");
          return `${header}.${encode({ name: "forged", aud: purpose })}.${signature}`;
        },
        error: "signature",
      },
      {
        name: "a request token",
        token: async () => createRequestTokenSigner({ privateKey, purpose })(body),
        error: "another type",
      },
      {
        name: "a token of no type",
        token: () => sign(current, { aud: purpose }, { typ: undefined }),
        error: "another type",
      },
    ])("rejects $name", async ({ token, error }) => {
      vi.useFakeTimers({ now, toFake: ["Date"] });

      await expect(verifyProof(await token(), options)).rejects.toThrow(error);
    });

    it("rejects every proof for a key that is not Ed25519", async () => {
      const publicKey = { kid: "current", kty: "EC", crv: "P-256" };

      await expect(
        verifyProof(await sign(current, { aud: purpose }, proofHeader), { publicKey, purpose })
      ).rejects.toThrow("signature");
    });
  });

  describe("verifyRequestToken", () => {
    const request = (claims: JwtPayload) => sign(current, { aud: purpose, bodySHA256, ...claims });

    it("accepts the token its signer made for the body", async () => {
      vi.useFakeTimers({ now, toFake: ["Date"] });
      const token = createRequestTokenSigner({ privateKey, purpose })(body);

      await expect(verifyRequestToken(token, new TextEncoder().encode(body), options)).resolves.toEqual({
        aud: purpose,
        iat: seconds,
        exp: seconds + 300,
        bodySHA256,
      });
    });

    it.each([
      { name: "29 seconds past its expiry", claims: { iat: seconds - 329, exp: seconds - 29 } },
      { name: "signed 30 seconds ahead", claims: { iat: seconds + 30, exp: seconds + 330 } },
    ])("accepts a token $name", async ({ claims }) => {
      vi.useFakeTimers({ now, toFake: ["Date"] });

      await expect(verifyRequestToken(await request(claims), body, options)).resolves.toEqual({
        aud: purpose,
        bodySHA256,
        ...claims,
      });
    });

    it.each([
      { name: "30 seconds past its expiry", claims: { iat: seconds - 330, exp: seconds - 30 }, error: "expired" },
      { name: "signed 31 seconds ahead", claims: { iat: seconds + 31, exp: seconds + 331 }, error: "not valid yet" },
      { name: "that lives past five minutes", claims: { iat: seconds, exp: seconds + 301 }, error: "lifetime" },
      { name: "without a lifetime", claims: {}, error: "lifetime" },
      {
        name: "of another body",
        claims: { iat: seconds, exp: seconds + 300, bodySHA256: otherBodySHA256 },
        error: "another body",
      },
    ])("rejects a token $name", async ({ claims, error }) => {
      vi.useFakeTimers({ now, toFake: ["Date"] });

      await expect(verifyRequestToken(await request(claims), body, options)).rejects.toThrow(error);
    });

    it("rejects a proof, even of the claims of a request token", async () => {
      vi.useFakeTimers({ now, toFake: ["Date"] });
      const proof = createProofSigner({ privateKey, purpose })({ exp: seconds + 300, bodySHA256 });

      await expect(verifyRequestToken(proof, body, options)).rejects.toThrow("another type");
    });
  });
});
