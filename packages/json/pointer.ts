import { type Json, isJsonObject } from "./json.js";

/**
 * Splits a JSON Pointer (RFC 6901) into its reference tokens, unescaped. RFC 6901 §7 leaves the
 * handling of an invalid pointer to the application: a `~` outside the escapes `~0` and `~1` is
 * read as written.
 *
 * @throws SyntaxError when a pointer that is not empty does not start with a slash.
 */
export function parseJsonPointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new SyntaxError(`Invalid JSON Pointer: ${pointer}`);

  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

/** Joins reference tokens into a JSON Pointer (RFC 6901), escaping each one. */
export function formatJsonPointer(tokens: readonly (string | number)[]): string {
  return tokens.map((token) => "/" + String(token).replaceAll("~", "~0").replaceAll("/", "~1")).join("");
}

const ARRAY_INDEX = /^(0|[1-9]\d*)$/;

/**
 * Reads the value a JSON Pointer (RFC 6901) names in `value`, or undefined when the pointer names
 * nothing. The pointer comes as a string or as its reference tokens. Only own members and array
 * indexes resolve.
 *
 * @throws SyntaxError on a string that {@link parseJsonPointer} refuses.
 */
export function resolveJsonPointer(value: Json | undefined, pointer: string | readonly string[]): Json | undefined {
  let node = value;

  for (const token of typeof pointer === "string" ? parseJsonPointer(pointer) : pointer) {
    if (Array.isArray(node)) node = ARRAY_INDEX.test(token) ? node[Number(token)] : undefined;
    else node = isJsonObject(node) && Object.hasOwn(node, token) ? node[token] : undefined;

    if (node === undefined) return undefined;
  }

  return node;
}
