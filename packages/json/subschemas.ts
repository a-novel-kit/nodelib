import { type Json, type JsonObject, isJsonObject } from "./json.js";

// Keywords whose value is a subschema, or a list of subschemas. `additionalItems` is older than
// draft 2020-12, and the validator still applies it.
const SUBSCHEMA_KEYWORDS = [
  "additionalItems",
  "additionalProperties",
  "allOf",
  "anyOf",
  "contains",
  "contentSchema",
  "else",
  "if",
  "items",
  "not",
  "oneOf",
  "prefixItems",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
];

// Keywords whose value maps names to subschemas. `definitions` and `dependencies` are older than
// draft 2020-12, and the validator still applies them.
const SUBSCHEMA_MAP_KEYWORDS = [
  "$defs",
  "definitions",
  "dependencies",
  "dependentSchemas",
  "patternProperties",
  "properties",
];

/**
 * Lists every subschema of `schema`, itself first, each with the reference tokens of its place in
 * `schema`. It walks by keyword, so a property named after a keyword and the content of a `default`
 * or an `enum` are never read as schemas. A boolean subschema is left out.
 */
export function listSubschemas(schema: JsonObject): [tokens: string[], subschema: JsonObject][] {
  const found: [string[], JsonObject][] = [[[], schema]];
  const add = (at: string[], node: Json | undefined) => {
    if (isJsonObject(node)) found.push([at, node]);
  };

  // The list grows while it is read: each subschema adds its own.
  for (const [at, node] of found) {
    for (const keyword of SUBSCHEMA_KEYWORDS) {
      const value = node[keyword];
      if (Array.isArray(value)) value.forEach((item, index) => add([...at, keyword, String(index)], item));
      else add([...at, keyword], value);
    }

    for (const keyword of SUBSCHEMA_MAP_KEYWORDS) {
      const map = node[keyword];
      for (const [name, value] of isJsonObject(map) ? Object.entries(map) : []) add([...at, keyword, name], value);
    }
  }

  return found;
}
