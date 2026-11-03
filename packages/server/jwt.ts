import { Buffer } from "node:buffer";

/** PublicJwk is one public key of an issuer's JSON Web Key Set (RFC 7517). */
export interface PublicJwk {
  /** The key ID, which a token names in its `kid` header. */
  kid: string;
  /** The key type and its parameters, such as `kty`, `crv` and `x` for an Ed25519 key. */
  [member: string]: unknown;
}

/** JwtPayload is the claims set of a verified JWT: its registered claims and the issuer's own. */
export type JwtPayload = Record<string, unknown>;

/** JwtVerifierOptions names the keys a verifier trusts and the claims it expects of a token. */
export interface JwtVerifierOptions {
  /**
   * Lists the issuer's public keys, such as a JWK Set endpoint. The verifier skips every key but the
   * Ed25519 ones. Callers wait on the list, so bound its duration.
   */
  fetchKeys: () => Promise<readonly PublicJwk[]>;
  /** The `iss` a token must carry. */
  issuer: string;
  /** The audience a token's `aud` must name. */
  audience: string;
  /** The `sub` a token must carry. */
  subject: string;
  /** The clock skew tolerated around a token's `exp` and `nbf`. */
  leewayMs: number;
  /** How long a fetched key set stays trusted before the next fetch. */
  cacheMs: number;
  /**
   * How long past `cacheMs` a key set stays in use while fetching fails (RFC 5861 stale-if-error).
   * A key the issuer withdrew stays trusted until then, so derive it from the issuer's key lifetime.
   * @default 0
   */
  staleIfErrorMs?: number;
}

// A token naming an unknown key forces a fetch only once the key set is this old, so forged key IDs
// cost the key source one call per interval at most.
const unknownKeyIntervalMs = 10_000;
// A failed fetch is retried only after this long, so a broken key source is not called per token.
const retryIntervalMs = 30_000;
// Cookies hold at most 4096 bytes. The bound keeps decoding cheap for any input.
const maxTokenLength = 8192;

const base64url = /^[A-Za-z0-9_-]+$/;

function decode(part: string): Uint8Array<ArrayBuffer> {
  if (!base64url.test(part)) throw new Error("malformed JWT");
  return new Uint8Array(Buffer.from(part, "base64url"));
}

function decodeObject(part: string): Record<string, unknown> {
  const value: unknown = JSON.parse(new TextDecoder().decode(decode(part)));
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("malformed JWT");

  return value as Record<string, unknown>;
}

function isEd25519(key: PublicJwk): boolean {
  return key.kty === "OKP" && key.crv === "Ed25519";
}

async function importKey(key: PublicJwk): Promise<readonly [string, CryptoKey]> {
  const imported = await crypto.subtle.importKey("jwk", key as JsonWebKey, "Ed25519", false, ["verify"]);
  return [key.kid, imported];
}

/** Checks the registered claims of RFC 7519 §4.1 that the options constrain. */
function checkClaims(payload: JwtPayload, options: JwtVerifierOptions, now: number): void {
  const { iss, sub, aud, exp, nbf } = payload;
  const audiences: unknown[] = Array.isArray(aud) ? aud : [aud];

  if (iss !== options.issuer || sub !== options.subject || !audiences.includes(options.audience)) {
    throw new Error("JWT issued for another use");
  }
  if (typeof exp !== "number" || now >= exp * 1000 + options.leewayMs) throw new Error("JWT expired");
  if (nbf !== undefined && (typeof nbf !== "number" || nbf * 1000 > now + options.leewayMs)) {
    throw new Error("JWT not valid yet");
  }
}

/**
 * createJwtVerifier returns a function that verifies a compact JWT (RFC 7519 §7.2) and resolves to
 * its claims. It accepts a token only when an Ed25519 key of the issuer's set signed it (RFC 9864)
 * and its claims match the options, `exp` included. It rejects any other token. Verification runs
 * locally: the key set is fetched once per `cacheMs`, and concurrent callers share one fetch.
 *
 * A token must name its key in `kid`, which RFC 7515 leaves optional. A key ID the set lacks
 * refetches the set, so a key the issuer has just rotated to verifies before the cache expires.
 * Create one verifier per process.
 */
export function createJwtVerifier(options: JwtVerifierOptions): (token: string) => Promise<JwtPayload> {
  const { fetchKeys, cacheMs, staleIfErrorMs = 0 } = options;

  let keys = new Map<string, CryptoKey>();
  let fetchedAt = Number.NEGATIVE_INFINITY;
  let failedAt = Number.NEGATIVE_INFINITY;
  let pending: Promise<void> | undefined;

  async function refresh(): Promise<void> {
    try {
      const fetched = await fetchKeys();
      keys = new Map(await Promise.all(fetched.filter(isEd25519).map(importKey)));
      fetchedAt = Date.now();
    } catch {
      failedAt = Date.now();
      if (failedAt - fetchedAt >= cacheMs + staleIfErrorMs) keys = new Map();
    }
  }

  async function findKey(kid: string): Promise<CryptoKey | undefined> {
    const age = Date.now() - fetchedAt;
    const due = age >= cacheMs || (!keys.has(kid) && age >= unknownKeyIntervalMs);

    if (due && Date.now() - failedAt >= retryIntervalMs) {
      pending ??= refresh().finally(() => {
        pending = undefined;
      });
      await pending;
    }

    return keys.get(kid);
  }

  return async (token) => {
    const parts = token.split(".");
    if (token.length > maxTokenLength || parts.length !== 3) throw new Error("malformed JWT");

    const [encodedHeader = "", encodedPayload = "", encodedSignature = ""] = parts;
    const header = decodeObject(encodedHeader);
    // RFC 9864 deprecates EdDSA, which named Ed25519 signatures before it, and keeps them valid.
    if (header.alg !== "Ed25519" && header.alg !== "EdDSA") throw new Error("JWT not signed with Ed25519");
    // RFC 7515 §4.1.11: a recipient rejects a token whose critical extensions it does not implement.
    if (header.crit !== undefined) throw new Error("JWT names critical extensions");
    if (typeof header.kid !== "string") throw new Error("JWT names no key");

    const key = await findKey(header.kid);
    const signed = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    if (!key || !(await crypto.subtle.verify("Ed25519", key, decode(encodedSignature), signed))) {
      throw new Error("JWT signature invalid");
    }

    const payload = decodeObject(encodedPayload);
    checkClaims(payload, options, Date.now());

    return payload;
  };
}
