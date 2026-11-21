import { type Json, type JsonObject, isJsonObject } from "./json.js";
import { formatJsonPointer, parseJsonPointer, resolveJsonPointer } from "./pointer.js";

import { type OutputUnit, Validator } from "@cfworker/json-schema";

/** A ValidationProblem is one reason why a value fails its schema. */
export interface ValidationProblem {
  /**
   * JSON Pointer (RFC 6901) to the failing value. A missing required property points to the object
   * that lacks it.
   */
  path: string;
  /** The reason, in English. The validator words it, so a message is shown and never parsed. */
  message: string;
}

/**
 * Lists what makes `value` invalid against `schema`, a JSON Schema of draft 2020-12. A valid value
 * lists nothing.
 *
 * Each problem names the innermost value that fails. A value that matches no branch of a `oneOf` or
 * an `anyOf` is one problem, unless the branches are tagged: when each branch sets a `const` on a
 * property and the value carries the tag of exactly one branch, the problems are those of that
 * branch.
 *
 * @throws Error when the schema cannot be evaluated, as with a `$ref` that resolves to nothing.
 * @throws RangeError when the value fails in more places than the validator can report. It reports
 *   several failures for one failing value, and Node 24 gives up past about 120,000 of them. A
 *   value of 4 MB can reach that number with about 10,000 failing values.
 */
export function validateJson(schema: JsonObject, value: Json): ValidationProblem[] {
  const { errors } = compile(schema).validate(value);

  return failures(schema, value, errors).map(({ at, error, missing }) => ({
    path: formatJsonPointer(missing ? at.slice(0, -1) : at),
    message: error,
  }));
}

/**
 * Builds the validator of a schema. It reports every failure, since salvage answers them all at
 * once.
 *
 * The validator gathers its failures through spread calls, so it throws a RangeError once a pass
 * reports more of them than a call takes arguments.
 */
export function compile(schema: JsonObject): Validator {
  return new Validator(schema, "2020-12", false);
}

/** A Failure is one failing location of a validation pass. */
export interface Failure {
  /** The reference tokens of the location. A missing property is located as if it were present. */
  at: string[];
  error: string;
  /** Set when the location is a required property the value lacks. */
  missing?: true;
  /** The schema default of that property, when it has one. */
  fill?: Json;
}

// Keywords that only relay the failures of the subschemas they apply. A relay sits outside the
// failure it reports, up to the root, so only the units that follow it locate anything.
const RELAY = new Set([
  "properties",
  "patternProperties",
  "additionalProperties",
  "unevaluatedProperties",
  "propertyNames",
  "items",
  "prefixItems",
  "unevaluatedItems",
  "$ref",
  "allOf",
  "if",
  "dependentSchemas",
]);

// Keywords that fail as a whole. The units under them say why each alternative was refused.
const WHOLE = new Set(["oneOf", "anyOf", "contains"]);

// The references followed from one schema before giving up, which ends a cycle of references.
const MAX_HOPS = 8;

/**
 * Lists the failing locations among the output units of one validation pass. The validator reports
 * one unit per failing keyword, parents first.
 */
export function failures(schema: JsonObject, value: Json, units: OutputUnit[]): Failure[] {
  const found: Failure[] = [];
  const seen = new Set<string>();

  // A tagged union recurses into the units of its branch. The depth is the number of unions around
  // a value, which the validator has already walked the same way.
  const walk = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      const unit = units[i]!;
      if (RELAY.has(unit.keyword)) continue;

      const at = tokensOf(unit.instanceLocation);
      if (unit.keyword === "required") {
        // The validator emits one unit per missing property. The first one lists them all.
        const application = unit.instanceLocation + unit.keywordLocation;
        if (!seen.has(application)) found.push(...missingProperties(schema, value, unit, at));
        seen.add(application);
        continue;
      }
      if (!WHOLE.has(unit.keyword)) {
        found.push({ at, error: unit.error });
        continue;
      }

      let next = i + 1;
      while (next < end && isUnder(units[next]!, unit.keywordLocation + "/")) next++;

      const branch =
        unit.keyword === "contains" ? undefined : taggedBranch(schema, units, i, next, resolveJsonPointer(value, at));
      if (branch) walk(branch.start, branch.end);
      else found.push({ at, error: unit.error });

      i = next - 1;
    }
  };

  walk(0, units.length);
  return found;
}

/**
 * Tells whether a unit belongs to the keyword at `prefix`. A "false" unit carries its instance
 * location as its keyword location, so it belongs to the unit before it.
 */
function isUnder(unit: OutputUnit, prefix: string): boolean {
  return unit.keyword === "false" || unit.keywordLocation.startsWith(prefix);
}

/** Lists the required properties an object lacks, read from the schema that requires them. */
function missingProperties(schema: JsonObject, value: Json, unit: OutputUnit, at: string[]): Failure[] {
  const object = schemaAt(schema, unit.keywordLocation.slice(0, -"/required".length));
  const instance = resolveJsonPointer(value, at);
  if (!isJsonObject(object) || !Array.isArray(object.required) || !isJsonObject(instance)) {
    return [{ at, error: unit.error }];
  }

  return object.required
    .filter((name): name is string => typeof name === "string" && !Object.hasOwn(instance, name))
    .map((name) => ({
      at: [...at, name],
      error: `Missing required property "${name}".`,
      missing: true,
      fill: defaultOf(schema, object, name),
    }));
}

/**
 * A tagged union names each branch with a const on a direct property. When the value carries the
 * tags of exactly one branch, only the failures of that branch count: returns the range of its
 * units.
 */
function taggedBranch(
  schema: JsonObject,
  units: OutputUnit[],
  start: number,
  end: number,
  value: Json | undefined
): { start: number; end: number } | undefined {
  const { keywordLocation } = units[start]!;
  const branches = schemaAt(schema, keywordLocation);
  const tagged = (Array.isArray(branches) ? branches : []).flatMap((branch, index) =>
    carriesTags(schema, branch, value) ? [index] : []
  );
  if (tagged.length !== 1) return undefined;

  const prefix = `${keywordLocation}/${tagged[0]}/`;
  let first = start + 1;
  while (first < end && !units[first]!.keywordLocation.startsWith(prefix)) first++;
  let last = first;
  while (last < end && isUnder(units[last]!, prefix)) last++;

  // Without a unit, the tagged branch passed and the union failed for another reason, such as a
  // oneOf with two matches.
  return first < last ? { start: first, end: last } : undefined;
}

/** Tells whether `value` holds the const of every tag of a union branch. A branch needs one tag. */
function carriesTags(schema: JsonObject, branch: Json | undefined, value: Json | undefined): boolean {
  for (let hops = 0; hops < MAX_HOPS && isJsonObject(branch) && typeof branch.$ref === "string"; hops++) {
    branch = local(schema, branch.$ref);
  }
  if (!isJsonObject(branch) || !isJsonObject(branch.properties) || !isJsonObject(value)) return false;

  const tags = Object.entries(branch.properties).filter(
    ([, property]) => isJsonObject(property) && Object.hasOwn(property, "const")
  );
  return tags.length > 0 && tags.every(([name, property]) => isJsonObject(property) && value[name] === property.const);
}

/** The schema default of a property, read through same-document references. */
function defaultOf(root: JsonObject, object: JsonObject, name: string): Json | undefined {
  const { properties } = object;
  let property = isJsonObject(properties) && Object.hasOwn(properties, name) ? properties[name] : undefined;

  for (
    let hops = 0;
    hops < MAX_HOPS && isJsonObject(property) && property.default === undefined && typeof property.$ref === "string";
    hops++
  ) {
    property = local(root, property.$ref);
  }

  return isJsonObject(property) ? property.default : undefined;
}

/** Decodes a validator location ("#/a/b", encoded as a URI fragment) into reference tokens. */
function tokensOf(location: string): string[] {
  return parseJsonPointer(decodeURIComponent(location.slice(1)));
}

/** Follows a same-document reference ("#" or "#/..."). Any other reference stays unresolved. */
function local(root: JsonObject, ref: string): Json | undefined {
  return ref === "#" || ref.startsWith("#/") ? resolveJsonPointer(root, tokensOf(ref)) : undefined;
}

/** Resolves a validator keywordLocation, which steps through "$ref" as if it were a member. */
function schemaAt(root: JsonObject, location: string): Json | undefined {
  let node: Json | undefined = root;

  for (const token of tokensOf(location)) {
    const ref: Json | undefined = token === "$ref" && isJsonObject(node) ? node.$ref : undefined;
    node = typeof ref === "string" ? local(root, ref) : resolveJsonPointer(node, [token]);
  }

  return node;
}
