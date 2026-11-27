import { Buffer } from "node:buffer";
import { type KeyObject, createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";

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
// The bound keeps decoding cheap for any input. A cookie holds at most 4096 bytes, and an API key
// signer refuses to make a longer token.
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

function importKey(key: PublicJwk): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", key as JsonWebKey, "Ed25519", false, ["verify"]);
}

/**
 * Parses a compact JWT (RFC 7519 §7.2) and resolves to its claims once the Ed25519 key that `keyFor`
 * finds for its header verifies its signature. `keyFor` throws to refuse a header.
 */
async function verifySignature(
  token: string,
  keyFor: (header: Record<string, unknown>) => Promise<CryptoKey | undefined>
): Promise<JwtPayload> {
  const parts = token.split(".");
  if (token.length > maxTokenLength || parts.length !== 3) throw new Error("malformed JWT");

  const [encodedHeader = "", encodedPayload = "", encodedSignature = ""] = parts;
  const header = decodeObject(encodedHeader);
  // RFC 9864 deprecates EdDSA, which named Ed25519 signatures before it, and keeps them valid.
  if (header.alg !== "Ed25519" && header.alg !== "EdDSA") throw new Error("JWT not signed with Ed25519");
  // RFC 7515 §4.1.11: a recipient rejects a token whose critical extensions it does not implement.
  if (header.crit !== undefined) throw new Error("JWT names critical extensions");

  const key = await keyFor(header);
  const signed = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  if (!key || !(await crypto.subtle.verify("Ed25519", key, decode(encodedSignature), signed))) {
    throw new Error("JWT signature invalid");
  }

  return decodeObject(encodedPayload);
}

/** Tells whether `aud` names the audience, alone or among several (RFC 7519 §4.1.3). */
function namesAudience(aud: unknown, audience: string): boolean {
  const audiences: unknown[] = Array.isArray(aud) ? aud : [aud];
  return audiences.includes(audience);
}

/** Rejects a token from its `exp` on and before its `nbf`, when it carries them (RFC 7519 §4.1.4, §4.1.5). */
function checkWindow({ exp, nbf }: JwtPayload, leewayMs: number): void {
  const now = Date.now();
  if (exp !== undefined && (typeof exp !== "number" || now >= exp * 1000 + leewayMs)) throw new Error("JWT expired");
  if (nbf !== undefined && (typeof nbf !== "number" || nbf * 1000 > now + leewayMs)) {
    throw new Error("JWT not valid yet");
  }
}

/** Checks the registered claims of RFC 7519 §4.1 that the options constrain. */
function checkClaims(payload: JwtPayload, options: JwtVerifierOptions): void {
  const { iss, sub, aud, exp } = payload;

  if (iss !== options.issuer || sub !== options.subject || !namesAudience(aud, options.audience)) {
    throw new Error("JWT issued for another use");
  }
  if (exp === undefined) throw new Error("JWT expired");
  checkWindow(payload, options.leewayMs);
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
      const fetched = (await fetchKeys()).filter(isEd25519);
      keys = new Map(await Promise.all(fetched.map(async (key) => [key.kid, await importKey(key)] as const)));
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
    const payload = await verifySignature(token, async ({ kid }) => {
      if (typeof kid !== "string") throw new Error("JWT names no key");
      return findKey(kid);
    });
    checkClaims(payload, options);

    return payload;
  };
}

/** ApiKeySignerOptions names the API key that signs, the one thing it may do, and its ID. */
export interface ApiKeySignerOptions {
  /** The private key of the API key, in PEM, as its owner keeps it. */
  privateKey: string;
  /** The purpose of the API key, which every token names in `aud`. */
  purpose: string;
  /**
   * The ID under which a key set lists the public key, which every token names in `kid`.
   * @default the JWK thumbprint of the public key, which is the ID of a system API key
   */
  keyID?: string;
}

/** ApiKeyVerifierOptions names the public key of an API key and the purpose a token must name. */
export interface ApiKeyVerifierOptions {
  /** The public key of the API key, as a key set lists it. */
  publicKey: PublicJwk;
  /** The purpose a token's `aud` must name. */
  purpose: string;
}

// RFC 8725 §3.11: each kind of token carries its own `typ`, and a verifier checks it exactly, so
// neither passes for the other.
const proofType = "proof+jwt";
const requestTokenType = "JWT";
// A request token authenticates one request, so it lives only as long as sending it takes.
const requestTokenLifetimeSeconds = 300;
// The clock skew tolerated between the holder of an API key and a verifier.
const apiKeyLeewayMs = 30_000;

function encodeObject(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function digest(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * jwkThumbprint returns the JWK thumbprint of an Ed25519 public key (RFC 7638, RFC 8037 §2): the
 * base64url SHA-256 of its `crv`, `kty` and `x`. It is the ID of a system API key.
 *
 * @throws When the key is not an Ed25519 public key.
 */
export function jwkThumbprint({ crv, kty, x }: JsonWebKey | PublicJwk): string {
  if (crv !== "Ed25519" || kty !== "OKP" || typeof x !== "string") throw new Error("not an Ed25519 public key");

  // RFC 7638 §3.3 hashes the required members in lexicographic order, without whitespace.
  return createHash("sha256").update(JSON.stringify({ crv, kty, x })).digest("base64url");
}

function readEd25519PrivateKey(pem: string): KeyObject {
  try {
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType === "ed25519") return key;
  } catch {
    // The error below replaces the parser's, so no error about the key carries any of it.
  }

  throw new Error("not an Ed25519 private key in PEM");
}

/** Returns a function that signs a payload with the API key, under a header naming `typ` and the key. */
function createSigner({ privateKey, keyID }: ApiKeySignerOptions, typ: string): (payload: JwtPayload) => string {
  const key = readEd25519PrivateKey(privateKey);
  const kid = keyID ?? jwkThumbprint(createPublicKey(key).export({ format: "jwk" }));
  const header = encodeObject({ alg: "EdDSA", typ, kid });

  return (payload) => {
    const signed = `${header}.${encodeObject(payload)}`;
    const token = `${signed}.${sign(null, Buffer.from(signed), key).toString("base64url")}`;
    if (token.length > maxTokenLength) throw new Error("JWT too long to verify");

    return token;
  };
}

/**
 * createProofSigner returns a function that signs a proof: a compact JWT (RFC 7519) of type
 * `proof+jwt` in which an API key vouches for the caller's claims. Its `aud` is the purpose and its
 * `iat` the time of signing, over any the claims set, and it never expires unless the claims set an
 * `exp`. It is signed with Ed25519 under the `EdDSA` label of RFC 8037, which RFC 9864 deprecates
 * and keeps valid.
 *
 * @throws When `privateKey` is not an Ed25519 private key in PEM. The error never quotes it. The
 * returned function throws when the claims make a token too long for the verifiers here to read.
 */
export function createProofSigner(options: ApiKeySignerOptions): (claims: JwtPayload) => string {
  const signProof = createSigner(options, proofType);

  return (claims) => signProof({ ...claims, aud: options.purpose, iat: nowSeconds() });
}

/**
 * createRequestTokenSigner returns a function that signs the request token of an API key for one
 * request body: a JWT of type `JWT` that names the purpose, lives five minutes (`iat`, `exp`) and
 * carries the lowercase hex SHA-256 of the body (`bodySHA256`).
 *
 * Sign the body exactly as sent: a string counts as its UTF-8 bytes, as fetch sends it.
 *
 * @throws When `privateKey` is not an Ed25519 private key in PEM. The error never quotes it.
 */
export function createRequestTokenSigner(options: ApiKeySignerOptions): (body: string | Uint8Array) => string {
  const signToken = createSigner(options, requestTokenType);

  return (body) => {
    const iat = nowSeconds();
    return signToken({ aud: options.purpose, iat, exp: iat + requestTokenLifetimeSeconds, bodySHA256: digest(body) });
  };
}

/**
 * Resolves to the claims of a token of type `typ` once the public key verifies its signature and its
 * `aud` names the purpose. An `exp` or `nbf` it carries holds, with 30 seconds of clock skew.
 */
async function verifyApiKeyToken(
  token: string,
  typ: string,
  { publicKey, purpose }: ApiKeyVerifierOptions
): Promise<JwtPayload> {
  const payload = await verifySignature(token, async (header) => {
    if (header.typ !== typ) throw new Error("JWT of another type");
    return isEd25519(publicKey) ? importKey(publicKey) : undefined;
  });
  if (!namesAudience(payload.aud, purpose)) throw new Error("JWT issued for another use");
  checkWindow(payload, apiKeyLeewayMs);

  return payload;
}

/**
 * verifyProof resolves to the claims of a proof once its type is `proof+jwt`, the public key of its
 * API key verifies its signature, and its `aud` names the purpose. Age is no failure, but an `exp` or
 * `nbf` the proof carries holds, with 30 seconds of clock skew (RFC 7519 §4.1.4, §4.1.5). It rejects
 * any other token, a request token included.
 */
export function verifyProof(token: string, options: ApiKeyVerifierOptions): Promise<JwtPayload> {
  return verifyApiKeyToken(token, proofType, options);
}

/**
 * verifyRequestToken resolves to the claims of a request token once its type is `JWT`, the public key
 * of its API key verifies its signature, its `aud` names the purpose, it names the digest of this
 * body, and it lives at most five minutes from its `iat`, with 30 seconds of clock skew on each side.
 * Pass the body exactly as received.
 */
export async function verifyRequestToken(
  token: string,
  body: string | Uint8Array,
  options: ApiKeyVerifierOptions
): Promise<JwtPayload> {
  const payload = await verifyApiKeyToken(token, requestTokenType, options);
  const { iat, exp, bodySHA256 } = payload;

  if (typeof iat !== "number" || typeof exp !== "number" || exp - iat > requestTokenLifetimeSeconds) {
    throw new Error("JWT lifetime invalid");
  }
  if (iat * 1000 > Date.now() + apiKeyLeewayMs) throw new Error("JWT not valid yet");
  if (bodySHA256 !== digest(body)) throw new Error("JWT signed for another body");

  return payload;
}
