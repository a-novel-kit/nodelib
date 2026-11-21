import type { JsonObject } from "./json.js";
import { v2 } from "./outline.fixture.js";
import { validateJson } from "./validate.js";

import { describe, expect, it } from "vitest";

const layers = [{ id: "l-0", kind: "notes", name: "Notes" }];
const withScene = (scene: JsonObject): JsonObject => ({
  beats: [
    { id: "b-0", title: "Opening", scenes: [{ id: "s-0", title: "Arrival", status: "draft", cells: [], ...scene }] },
  ],
  layers,
});

describe("validateJson", () => {
  it("lists nothing for a valid value", () => {
    expect(validateJson(v2, withScene({}))).toEqual([]);
  });

  it("names the innermost failing value, without the objects around it", () => {
    expect(validateJson(v2, withScene({ title: 5 }))).toEqual([
      { path: "/beats/0/scenes/0/title", message: 'Instance type "number" is invalid. Expected "string".' },
    ]);
  });

  it("lists every problem of a value", () => {
    const problems = validateJson(v2, withScene({ title: "x".repeat(150), pov: "Mara" }));
    expect(problems.map((problem) => problem.path)).toEqual(["/beats/0/scenes/0/title", "/beats/0/scenes/0/pov"]);
  });

  it("points a missing required property at the object that lacks it", () => {
    const scene = { id: "s-0", title: "Arrival", cells: [] };

    expect(validateJson(v2, { beats: [{ id: "b-0", title: "Opening", scenes: [scene] }] })).toEqual([
      { path: "", message: 'Missing required property "layers".' },
      { path: "/beats/0/scenes/0", message: 'Missing required property "status".' },
    ]);
  });

  it("reports a wrong root type at the root", () => {
    expect(validateJson(v2, [])).toEqual([
      { path: "", message: 'Instance type "array" is invalid. Expected "object".' },
    ]);
  });

  it("names the failing property of a tagged union branch", () => {
    const notes = { kind: "notes", layer: "l-0", text: "fine", format: "html" };
    expect(validateJson(v2, withScene({ cells: [notes] })).map((problem) => problem.path)).toEqual([
      "/beats/0/scenes/0/cells/0/format",
    ]);
  });

  it("reports a value that matches no branch of a union as one problem", () => {
    const unknown = { kind: "music", layer: "l-0" };
    expect(validateJson(v2, withScene({ cells: [unknown] }))).toEqual([
      { path: "/beats/0/scenes/0/cells/0", message: "Instance does not match exactly one subschema (0 matches)." },
    ]);
  });

  it("escapes the member names of a path as a JSON Pointer", () => {
    const schema = { properties: { "a b/c~d": { type: "string" }, "100%": { type: "string" } } };
    const problems = validateJson(schema, { "a b/c~d": 1, "100%": 2 });

    expect(problems.map((problem) => problem.path)).toEqual(["/a b~1c~0d", "/100%"]);
  });

  it("throws on a schema it cannot evaluate", () => {
    expect(() => validateJson({ $ref: "#/$defs/missing" }, {})).toThrow('Unresolved $ref "#/$defs/missing"');
  });

  it("throws a RangeError when the value fails in more places than the validator can report", () => {
    const schema = { properties: { list: { items: { type: "string" } } } };
    const list = Array.from({ length: 200_000 }, () => 0);

    expect(() => validateJson(schema, { list })).toThrow(RangeError);
  });
});
