import type { Json } from "./json.js";
import { formatJsonPointer, parseJsonPointer, resolveJsonPointer } from "./pointer.js";

import { describe, expect, it } from "vitest";

describe("resolveJsonPointer", () => {
  const document = { a: { "b/c": [10, 20], "~": 1, "": 2 }, list: [1, 2] };
  const cases: [pointer: string, expected: Json | undefined][] = [
    ["", document],
    ["/a/b~1c/1", 20],
    ["/a/~0", 1],
    ["/a/", 2],
    ["/list/1", 2],
    // Inherited members, non-canonical indexes and missing members resolve to nothing.
    ["/constructor", undefined],
    ["/__proto__", undefined],
    ["/list/length", undefined],
    ["/list/01", undefined],
    ["/list/-", undefined],
    ["/list/2", undefined],
    ["/missing/x", undefined],
  ];

  it.each(cases)("reads %j", (pointer, expected) => {
    expect(resolveJsonPointer(document, parseJsonPointer(pointer))).toEqual(expected);
  });

  it.each(cases)("reads %j from the pointer itself", (pointer, expected) => {
    expect(resolveJsonPointer(document, pointer)).toEqual(expected);
  });

  it("reads nothing from a value that is not there", () => {
    expect(resolveJsonPointer(undefined, "/a")).toBeUndefined();
  });

  it("refuses a string that is no pointer", () => {
    expect(() => resolveJsonPointer(document, "a")).toThrow(SyntaxError);
  });
});

describe("parseJsonPointer and formatJsonPointer", () => {
  it("round-trips tokens", () => {
    expect(formatJsonPointer(parseJsonPointer("/a/b~1c/~0/"))).toBe("/a/b~1c/~0/");
    expect(parseJsonPointer("/a~1b/~01")).toEqual(["a/b", "~1"]);
  });

  it("refuses a pointer that does not start with a slash", () => {
    expect(() => parseJsonPointer("a/b")).toThrow(SyntaxError);
  });

  it("keeps a tilde outside the escapes as written", () => {
    expect(parseJsonPointer("/a~2/b~")).toEqual(["a~2", "b~"]);
  });

  it("formats array indexes given as numbers", () => {
    expect(formatJsonPointer(["list", 0, "a/b"])).toBe("/list/0/a~1b");
  });
});
