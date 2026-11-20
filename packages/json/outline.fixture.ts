// Schemas and values of a story outline, for the tests. Version 2 is derived from version 1 by
// explicit edits, so every breaking change shows in one place.
import { type Json, type JsonObject, isJsonObject } from "./json.js";
import { parseJsonPointer, resolveJsonPointer } from "./pointer.js";

const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "gray"];

const closed = (required: string[], properties: JsonObject): JsonObject => ({
  type: "object",
  additionalProperties: false,
  required,
  properties,
});

const id = { $ref: "#/$defs/id" };

export const v1: JsonObject = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://schemas.test/outline/1.0.0",
  ...closed(["beats", "layers"], {
    beats: { type: "array", maxItems: 5000, items: { $ref: "#/$defs/beat" } },
    layers: { type: "array", maxItems: 50, items: { $ref: "#/$defs/layer" } },
  }),
  default: { beats: [], layers: [] },
  $defs: {
    id: { type: "string", minLength: 1, maxLength: 36, pattern: "^[a-z0-9-]+$" },
    beat: closed(["id", "title", "scenes"], {
      id,
      title: { type: "string", maxLength: 200 },
      color: { enum: COLORS },
      description: { type: "string", maxLength: 2000 },
      act: { type: "string" },
      scenes: { type: "array", items: { $ref: "#/$defs/scene" } },
    }),
    scene: closed(["id", "title", "cells"], {
      id,
      title: { type: "string", maxLength: 200 },
      summary: { type: "string", maxLength: 2000 },
      pov: { type: "string", maxLength: 100 },
      cells: { type: "array", items: { $ref: "#/$defs/cell" } },
    }),
    // A union tagged by `kind`.
    cell: {
      oneOf: [
        { $ref: "#/$defs/notesCell" },
        { $ref: "#/$defs/loglineCell" },
        { $ref: "#/$defs/scriptCell" },
        { $ref: "#/$defs/linkCell" },
      ],
    },
    notesCell: closed(["kind", "layer", "text"], {
      kind: { const: "notes" },
      layer: id,
      text: { type: "string", maxLength: 10000 },
      format: { enum: ["plain", "markdown", "html"] },
    }),
    loglineCell: closed(["kind", "layer", "line"], {
      kind: { const: "logline" },
      layer: id,
      line: { type: "string", maxLength: 280 },
    }),
    scriptCell: closed(["kind", "layer", "blocks"], {
      kind: { const: "script" },
      layer: id,
      blocks: { type: "array", items: { $ref: "#/$defs/block" } },
    }),
    block: closed(["id", "type", "text"], {
      id,
      type: { enum: ["narration", "dialogue", "action"] },
      speaker: { type: "string", maxLength: 100 },
      text: { type: "string", maxLength: 5000 },
    }),
    linkCell: closed(["kind", "layer", "links"], {
      kind: { const: "link" },
      layer: id,
      links: { type: "array", items: { $ref: "#/$defs/link" } },
    }),
    link: closed(["target", "relation"], {
      target: { type: "string", minLength: 1, maxLength: 200 },
      relation: { enum: ["therefore", "but", "meanwhile"] },
    }),
    layer: closed(["id", "kind", "name"], {
      id,
      kind: { enum: ["notes", "logline", "script", "link"] },
      name: { type: "string", minLength: 1, maxLength: 100 },
      color: { enum: COLORS },
      accepts: { type: "string" },
    }),
  },
};

/** One edit of a schema: the JSON Pointer of a value and its replacement, where undefined removes it. */
export type Edit = [pointer: string, value?: Json];

/**
 * Returns a copy of `schema` with the edits applied in order. A pointer ending in `-` appends to
 * an array.
 */
export function edit(schema: JsonObject, ...edits: Edit[]): JsonObject {
  const copy = structuredClone(schema);

  for (const [pointer, value] of edits) {
    const tokens = parseJsonPointer(pointer);
    const parent = resolveJsonPointer(copy, tokens.slice(0, -1));
    const key = tokens.at(-1) ?? "";

    if (Array.isArray(parent)) {
      parent.splice(key === "-" ? parent.length : Number(key), 1, ...(value === undefined ? [] : [value]));
    } else if (!isJsonObject(parent)) throw new Error(`Nothing to edit at ${pointer}`);
    else if (value === undefined) delete parent[key];
    else parent[key] = value;
  }

  return copy;
}

export const v2 = edit(
  v1,
  ["/$id", "https://schemas.test/outline/2.0.0"],
  // 1. Removed property.
  ["/$defs/scene/properties/pov"],
  // 2. Type change (optional property).
  ["/$defs/beat/properties/act", { type: "integer", minimum: 1 }],
  // 3. Tightened maxLength: once on an optional property, once on a required one.
  ["/$defs/scene/properties/summary/maxLength", 500],
  ["/$defs/scene/properties/title/maxLength", 120],
  // 4. New required property with a default.
  ["/$defs/scene/properties/status", { enum: ["draft", "review", "done"], default: "draft" }],
  ["/$defs/scene/required/-", "status"],
  // 5. New required property without a default.
  ["/$defs/link/properties/export", { type: "string", minLength: 1 }],
  ["/$defs/link/required/-", "export"],
  // 6. Removed enum value: once on an optional property, once on a required one.
  ["/$defs/beat/properties/color", { enum: COLORS.filter((color) => color !== "gray") }],
  ["/$defs/block/properties/type", { enum: ["narration", "dialogue"] }],
  // 7. Changes inside the tagged union: an optional and a required property of one branch.
  ["/$defs/notesCell/properties/format", { enum: ["plain", "markdown"] }],
  ["/$defs/loglineCell/properties/line/maxLength", 140]
);

/** Version 2 with a required root property that has no default, for the abort path. */
export const v2RootRequired = edit(
  v2,
  ["/properties/meta", closed(["owner"], { owner: { type: "string" } })],
  ["/required/-", "meta"]
);

/** Version 2 where a link cell needs a link, so that emptying its list cascades. */
export const v2MinItems = edit(v2, ["/$defs/linkCell/properties/links/minItems", 1]);

/** Version 2 with its union written as an anyOf. */
export const v2AnyOf = edit(v2, ["/$defs/cell", { anyOf: resolveJsonPointer(v2, "/$defs/cell/oneOf") ?? [] }]);

const WORDS =
  "the night was long and the road ran north past a broken mill where nobody had lived since the war she kept the letter folded twice inside her coat and said nothing of it to anyone until morning came".split(
    " "
  );

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Scene = JsonObject & { id: string; title: string };
type Beat = JsonObject & { id: string; title: string; scenes: Scene[] };

/**
 * Generates a value of about `targetBytes` that is valid against version 1 and carries a
 * realistic share of what version 2 refuses. The same seed gives the same value.
 */
export function generate(targetBytes: number, seed = 1): JsonObject & { beats: Beat[] } {
  const rnd = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
  const pick = (list: string[]) => list[int(0, list.length - 1)] ?? "";
  const chance = (p: number) => rnd() < p;
  const text = (min: number, max: number) => {
    const length = int(min, max);
    let out = "";
    while (out.length < length) out += (out ? " " : "") + pick(WORDS);
    return out.slice(0, length);
  };
  let n = 0;
  const nextId = (prefix: string) => `${prefix}-${(n++).toString(36)}`;

  const layers = ["notes", "notes", "logline", "script", "link", "link"].map((kind, i) => {
    const layer: JsonObject & { id: string; kind: string } = { id: nextId("l"), kind, name: `${kind} ${i + 1}` };
    if (chance(0.5)) layer.color = pick(COLORS);
    return layer;
  });

  const block = (): JsonObject => {
    // Version 2 removes "action": 10% break.
    const type = chance(0.1) ? "action" : pick(["narration", "dialogue"]);
    const made: JsonObject = { id: nextId("k"), type };
    if (type === "dialogue") made.speaker = text(4, 12);
    made.text = text(60, 300);
    return made;
  };

  // Version 2 requires `export` on every link: all break.
  const link = (): JsonObject => ({
    target: `scenes/s-${int(0, 999).toString(36)}`,
    relation: pick(["therefore", "but", "meanwhile"]),
  });

  const cell = (layer: { id: string; kind: string }): JsonObject => {
    const made: JsonObject = { kind: layer.kind, layer: layer.id };
    if (layer.kind === "notes") {
      made.text = text(100, 700);
      if (chance(0.3)) made.format = pick(["plain", "markdown", "html"]);
    } else if (layer.kind === "logline") {
      // Version 2 tightens `line` to 140: 5% break.
      made.line = chance(0.05) ? text(150, 270) : text(60, 130);
    } else if (layer.kind === "script") {
      made.blocks = Array.from({ length: int(2, 6) }, block);
    } else {
      made.links = Array.from({ length: int(1, 3) }, link);
    }
    return made;
  };

  const scene = (): Scene => {
    // Version 2 tightens `title` to 120 and it is required: 1% break.
    const made: Scene = { id: nextId("s"), title: chance(0.01) ? text(130, 190) : text(10, 60) };
    // Version 2 tightens `summary` to 500: 5% of scenes break.
    if (chance(0.5)) made.summary = chance(0.1) ? text(600, 1500) : text(100, 400);
    // Version 2 removes `pov`.
    if (chance(0.3)) made.pov = text(5, 20);
    made.cells = layers.filter(() => chance(0.8)).map(cell);
    return made;
  };

  const beat = (): Beat => {
    const made: Beat = { id: nextId("b"), title: text(8, 40), scenes: [] };
    if (chance(0.7)) made.color = pick(COLORS);
    if (chance(0.5)) made.description = text(80, 400);
    // Version 2 turns `act` into an integer.
    if (chance(0.5)) made.act = String(int(1, 3));
    return made;
  };

  const outline: JsonObject & { beats: Beat[] } = { beats: [], layers };
  let size = JSON.stringify(outline).length;
  const [fewest, most] = targetBytes < 200_000 ? [3, 5] : [8, 14];
  while (size < targetBytes) {
    const made = beat();
    const count = int(fewest, most);
    for (let i = 0; i < count && size + JSON.stringify(made).length < targetBytes; i++) made.scenes.push(scene());
    outline.beats.push(made);
    size += JSON.stringify(made).length + 1;
  }

  return outline;
}
