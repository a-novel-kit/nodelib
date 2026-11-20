import type { JsonObject } from "./json.js";
import { formatJsonPointer } from "./pointer.js";
import { listSubschemas } from "./subschemas.js";

import { describe, expect, it } from "vitest";

/** Lists the places of the subschemas of a schema, as JSON Pointers. */
const places = (schema: JsonObject) => listSubschemas(schema).map(([tokens]) => formatJsonPointer(tokens));

describe("listSubschemas", () => {
  it("lists the schema itself, at the empty pointer", () => {
    const schema = { type: "string" };

    expect(listSubschemas(schema)).toEqual([[[], schema]]);
    expect(listSubschemas(schema)[0]?.[1]).toBe(schema);
  });

  const single = [
    "additionalItems",
    "additionalProperties",
    "contains",
    "contentSchema",
    "else",
    "if",
    "items",
    "not",
    "propertyNames",
    "then",
    "unevaluatedItems",
    "unevaluatedProperties",
  ];

  it.each(single)("finds the subschema under %s", (keyword) => {
    expect(places({ [keyword]: { type: "string" } })).toEqual(["", `/${keyword}`]);
  });

  it.each(["allOf", "anyOf", "oneOf", "prefixItems", "items"])(
    "finds each subschema of the list under %s",
    (keyword) => {
      expect(places({ [keyword]: [{}, { type: "string" }] })).toEqual(["", `/${keyword}/0`, `/${keyword}/1`]);
    }
  );

  const maps = ["$defs", "definitions", "dependencies", "dependentSchemas", "patternProperties", "properties"];

  it.each(maps)("finds each named subschema under %s", (keyword) => {
    expect(places({ [keyword]: { a: {}, "b/c": {} } })).toEqual(["", `/${keyword}/a`, `/${keyword}/b~1c`]);
  });

  it("lists the subschemas of subschemas, one level after the other", () => {
    const schema = {
      properties: { list: { items: { not: {} } }, name: { anyOf: [{}, {}] } },
      $defs: { id: {} },
    };

    expect(places(schema)).toEqual([
      "",
      "/$defs/id",
      "/properties/list",
      "/properties/name",
      "/properties/list/items",
      "/properties/name/anyOf/0",
      "/properties/name/anyOf/1",
      "/properties/list/items/not",
    ]);
  });

  it("reads a property named after a keyword, and the content of a value, as data", () => {
    const data = { items: { type: "string" }, properties: { a: {} }, $defs: { b: {} } };
    const schema = {
      properties: {
        items: { type: "string" },
        $defs: { type: "string" },
        first: { default: data, const: data, enum: [data], examples: [data] },
      },
    };

    expect(places(schema)).toEqual(["", "/properties/items", "/properties/$defs", "/properties/first"]);
  });

  it("leaves out what is no object: a boolean subschema and the names a dependency requires", () => {
    const schema = {
      additionalProperties: false,
      items: true,
      prefixItems: [true, {}],
      properties: { a: true },
      dependencies: { a: ["b"] },
    };

    expect(places(schema)).toEqual(["", "/prefixItems/1"]);
  });
});
