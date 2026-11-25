import { type Json, type JsonObject, isJsonObject } from "./json.js";
import { formatJsonPointer, resolveJsonPointer } from "./pointer.js";
import { compile, failures } from "./validate.js";

/** A SalvageRemoval is one subtree that salvage removed from the value. */
export interface SalvageRemoval {
  /** JSON Pointer (RFC 6901) to the subtree in the input. */
  path: string;
  /** The subtree, as the input holds it. */
  value: Json;
  /** Why the subtree left. */
  errors: string[];
  /** The pass that removed the subtree. After the first pass, a removal answers an error an earlier one created. */
  pass: number;
}

/**
 * A SalvageResult is the outcome of {@link salvageJson}: a valid value with what left it, or the
 * reason why the root cannot be made valid.
 */
export type SalvageResult =
  | {
      ok: true;
      /** A valid copy of the input, without the subtrees that failed. */
      value: Json;
      /** The outermost subtrees that failed, in input coordinates. */
      removed: SalvageRemoval[];
      /** JSON Pointers, into the input, to the required properties that took their schema default. */
      filled: string[];
      /** The number of validation passes it took. */
      passes: number;
    }
  | {
      ok: false;
      /** The input itself. */
      value: Json;
      reason: string;
    };

// Each pass climbs one level, so a value that fails deeper than this through chained required
// properties is refused instead of cut.
const MAX_PASSES = 16;

/**
 * Makes `value` valid against `schema`, a JSON Schema of draft 2020-12, by moving every failing
 * subtree aside. It validates, removes the outermost failing subtrees, and repeats until what
 * remains is valid. A missing required property takes its schema default. Without a default, or
 * when the default does not hold, the object that lacks the property leaves.
 *
 * The value cannot be made valid when its root has the wrong type, lacks a required property that
 * has no default, or is still invalid after 16 passes. The input is never modified.
 *
 * @throws What {@link validateJson} throws.
 */
export function salvageJson(schema: JsonObject, value: Json): SalvageResult {
  const validator = compile(schema);
  const work = structuredClone(value);
  // Array of `work` => the input index of each item it still holds.
  const origin = new WeakMap<Json[], number[]>();
  // Input pointer => removal.
  const removed = new Map<string, SalvageRemoval>();
  // Input pointers that received a schema default.
  const filled = new Set<string>();

  /** Translates tokens of `work` into a pointer into the input. */
  const inputPath = (tokens: string[]): string => {
    let node: Json | undefined = work;
    const inputTokens = tokens.map((token) => {
      const index = Array.isArray(node) ? (origin.get(node)?.[Number(token)] ?? token) : token;
      node = resolveJsonPointer(node, [token]);
      return index;
    });

    return formatJsonPointer(inputTokens);
  };

  for (let passes = 1; passes <= MAX_PASSES; passes++) {
    const result = validator.validate(work);
    if (result.valid) {
      return { ok: true, value: work, removed: [...removed.values()], filled: [...filled], passes };
    }

    // Pointer into `work` => what leaves there, and why.
    const removals = new Map<string, { at: string[]; errors: string[] }>();
    const fills: { at: string[]; fill: Json }[] = [];
    for (const { at, error, missing, fill } of failures(schema, work, result.errors)) {
      // A default fills a missing property once. Without one, or when it did not hold, the parent goes.
      if (fill !== undefined && !filled.has(inputPath(at))) {
        fills.push({ at, fill });
        continue;
      }

      const target = missing ? at.slice(0, -1) : at;
      const removal = removals.get(formatJsonPointer(target)) ?? { at: target, errors: [] };
      removal.errors.push(error);
      removals.set(formatJsonPointer(target), removal);
    }

    const root = removals.get("");
    if (root) return { ok: false, value, reason: root.errors.join(" ") };

    // Only the outermost locations are cut, and nothing is filled inside one.
    const isInside = ({ at }: { at: string[] }) =>
      at.some((_, depth) => removals.has(formatJsonPointer(at.slice(0, depth))));

    for (const { at, fill } of fills.filter((entry) => !isInside(entry))) {
      const parent = resolveJsonPointer(work, at.slice(0, -1));
      if (isJsonObject(parent)) parent[at.at(-1)!] = structuredClone(fill);
      filled.add(inputPath(at));
    }

    // Paths and parents are read before anything moves.
    const cuts = [...removals.values()]
      .filter((removal) => !isInside(removal))
      .map(({ at, errors }) => ({
        parent: resolveJsonPointer(work, at.slice(0, -1)),
        key: at.at(-1)!,
        path: inputPath(at),
        errors,
      }));

    for (const cut of cuts) {
      // An earlier pass may have moved parts of this subtree: the whole input subtree replaces them.
      if (passes > 1) {
        for (const path of [...removed.keys(), ...filled]) {
          if (!path.startsWith(cut.path + "/")) continue;

          cut.errors.push(...(removed.get(path)?.errors ?? []));
          removed.delete(path);
          filled.delete(path);
        }
      }

      const subtree = resolveJsonPointer(value, cut.path);
      if (subtree !== undefined) {
        removed.set(cut.path, { path: cut.path, value: subtree, errors: cut.errors, pass: passes });
      }
      if (isJsonObject(cut.parent)) delete cut.parent[cut.key];
    }

    // Array items leave last, highest index first, so that no pending index shifts.
    const items = cuts.flatMap(({ parent, key }) => (Array.isArray(parent) ? [{ parent, index: Number(key) }] : []));
    for (const { parent, index } of items.sort((a, b) => b.index - a.index)) {
      const indexes = origin.get(parent) ?? parent.map((_, position) => position);
      indexes.splice(index, 1);
      parent.splice(index, 1);
      origin.set(parent, indexes);
    }
  }

  return { ok: false, value, reason: `Not valid after ${MAX_PASSES} passes.` };
}
