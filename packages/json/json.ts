/** A JSON value: what `JSON.parse` returns. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** A JSON object, such as a JSON Schema. */
export type JsonObject = { [key: string]: Json };

/** Tells an object from every other value, arrays and null included. Its members stay unchecked. */
export function isJsonObject(value: unknown): value is { [key: string]: unknown } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
