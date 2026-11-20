# @a-novel-kit/nodelib-json

Tools for JSON values: JSON Pointers, and the validation and repair of a value against a JSON
Schema.

The package uses no DOM, no Node built-in and no framework, so it runs in a browser, a Worker and
Node. Its validator evaluates schemas without `eval`, which a strict Content Security Policy
requires.

## Installation

Configure the `@a-novel-kit` registry as the
[nodelib README](https://github.com/a-novel-kit/nodelib#installation) shows, then add the package:

```bash
pnpm add @a-novel-kit/nodelib-json
```

## JSON values

`Json` types any JSON value, and `JsonObject` a JSON object such as a schema. `isJsonObject` tells an
object from every other value, arrays and `null` included.

## JSON Pointers

A JSON Pointer ([RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)) names one value inside a JSON
value. Its reference tokens are the member names and array indexes on the way there.

```ts
import { formatJsonPointer, parseJsonPointer, resolveJsonPointer } from "@a-novel-kit/nodelib-json";

const story = { beats: [{ title: "Opening", "a/b": 1 }] };

resolveJsonPointer(story, "/beats/0/title"); // "Opening"
resolveJsonPointer(story, "/beats/1/title"); // undefined
resolveJsonPointer(story, "/beats/length"); // undefined

parseJsonPointer("/beats/0/a~1b"); // ["beats", "0", "a/b"]
formatJsonPointer(["beats", 0, "a/b"]); // "/beats/0/a~1b"
```

`resolveJsonPointer` reads own members and array indexes only. It also takes the tokens
`parseJsonPointer` returns, which spares parsing a pointer that is read many times.

## Validation

`validateJson` lists what makes a value invalid against a JSON Schema of draft 2020-12. A valid
value lists nothing.

```ts
import { validateJson } from "@a-novel-kit/nodelib-json";

const schema = {
  type: "object",
  required: ["title", "status"],
  properties: {
    title: { type: "string" },
    status: { enum: ["draft", "done"], default: "draft" },
    tags: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
};

validateJson(schema, { title: "Dune", tags: ["sand", 7], year: 1965 });
// [
//   { path: "", message: 'Missing required property "status".' },
//   { path: "/tags/1", message: 'Instance type "number" is invalid. Expected "string".' },
//   { path: "/year", message: "False boolean schema." },
// ]
```

Each problem holds a JSON Pointer to the innermost value that fails, and a message in English. A
missing required property points to the object that lacks it. The validator words most messages, so
show a message and never parse it.

A value that matches no branch of a `oneOf` or an `anyOf` is one problem, since no branch says which
one the value meant. A tagged union says it: when each branch sets a `const` on a property, such as
`kind`, and the value carries the tag of exactly one branch, the problems are those of that branch.

## Salvage

`salvageJson` makes a value valid by moving every failing subtree aside. It validates, removes the
outermost failing subtrees, and repeats until what remains is valid. A missing required property
takes its schema `default`. The input is never modified.

```ts
import { salvageJson } from "@a-novel-kit/nodelib-json";

salvageJson(schema, { title: "Dune", tags: ["sand", 7], year: 1965 });
// {
//   ok: true,
//   value: { title: "Dune", tags: ["sand"], status: "draft" },
//   removed: [
//     { path: "/tags/1", value: 7, errors: ['Instance type "number" is invalid. Expected "string".'], pass: 1 },
//     { path: "/year", value: 1965, errors: ["False boolean schema."], pass: 1 },
//   ],
//   filled: ["/status"],
//   passes: 2,
// }
```

| Member    | What it holds                                                                     |
| --------- | --------------------------------------------------------------------------------- |
| `value`   | A valid copy of the input, without the subtrees that failed                       |
| `removed` | The outermost subtrees that failed, each with its JSON Pointer into the input     |
| `filled`  | JSON Pointers, into the input, to the required properties that took their default |
| `passes`  | The number of validation passes it took                                           |

A removal can create a new failure, such as an array that falls under its `minItems`. The next pass
then removes the parent, and the whole input subtree leaves as one entry.

A required property without a default takes the object that lacks it along. The root cannot leave,
so three cases return `{ ok: false, value, reason }` with the input itself: a root of the wrong
type, a root that lacks a required property without a default, and a value still invalid after 16
passes.

```ts
salvageJson(schema, { tags: [] });
// { ok: false, value: { tags: [] }, reason: 'Missing required property "title".' }
```

## Subschemas

`listSubschemas` lists every subschema of a schema, itself first, each with the reference tokens of
its place. It walks by keyword, so a property named `items` and the content of a `default` are never
read as schemas.

```ts
import { formatJsonPointer, listSubschemas } from "@a-novel-kit/nodelib-json";

listSubschemas(schema).map(([tokens]) => formatJsonPointer(tokens));
// ["", "/properties/title", "/properties/status", "/properties/tags", "/properties/tags/items"]
```

## Limits

`validateJson` and `salvageJson` block while they run. A value of a few megabytes takes about a
second to salvage, so run large values in a Worker.

Both throw on a schema that cannot be evaluated, as with a `$ref` that resolves to nothing. They
also throw a `RangeError` when a value fails in more places than the validator can report. The
validator reports several failures for one failing value, and Node 24 gives up past about 120,000 of
them. A value of 4 MB can reach that number with about 10,000 failing values. Treat a thrown error
as a value that cannot be validated.

The package pins [`@cfworker/json-schema`](https://www.npmjs.com/package/@cfworker/json-schema) to
an exact version, since `salvageJson` reads the order and the shape of the validator's output.
