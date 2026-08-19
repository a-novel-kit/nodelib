const environmentValue = Symbol("environment-value");
const invalidEnvironmentValue = Symbol("invalid-environment-value");

/** A private process environment supplied by a server framework or `process.env`. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

/** An EnvironmentField binds one output value to its private environment variable. */
export interface EnvironmentField<Value> {
  /** The variable name reported when its value is invalid. */
  readonly name: string;
  /** Carries the parsed value type without exposing the field parser. */
  readonly [environmentValue]: Value;
}

interface EnvironmentFieldDefinition<Value> extends EnvironmentField<Value> {
  parse(value: string | undefined): Value;
}

/** EnvironmentSchema maps application config properties to their private variables. */
export type EnvironmentSchema = Readonly<Record<string, EnvironmentField<unknown>>>;

/** EnvironmentOutput derives the application config type produced by an environment schema. */
export type EnvironmentOutput<Schema extends EnvironmentSchema> = {
  [Key in keyof Schema]: Schema[Key] extends EnvironmentField<infer Value> ? Value : never;
};

/** EnvironmentValidationError identifies invalid variables without retaining or exposing their values. */
export class EnvironmentValidationError extends Error {
  /** Invalid variable names in stable lexical order. */
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    const stableFields = [...new Set(fields)].sort();
    super(`Invalid server environment: ${stableFields.length > 0 ? stableFields.join(", ") : "unknown field"}`);
    this.name = "EnvironmentValidationError";
    this.fields = stableFields;
  }
}

function invalidValue(): never {
  throw invalidEnvironmentValue;
}

function field<Value>(name: string, parse: (value: string | undefined) => Value): EnvironmentField<Value> {
  if (name.length === 0) {
    throw new RangeError("An environment variable name is required");
  }

  return { name, parse } as EnvironmentFieldDefinition<Value>;
}

/** Defines a required HTTP or HTTPS base URL that excludes credentials, query parameters, and fragments. */
export function environmentHttpUrl(name: string): EnvironmentField<string> {
  return field(name, (value) => {
    if (!value) return invalidValue();

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return invalidValue();
    }

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.search.length > 0 ||
      url.hash.length > 0
    ) {
      return invalidValue();
    }

    return url.toString().replace(/\/+$/, "");
  });
}

/** IntegerEnvironmentOptions bounds an integer variable and supplies its optional default. */
export interface IntegerEnvironmentOptions {
  /** The value used when the variable is absent. */
  defaultValue?: number;
  /** The inclusive lower bound. */
  minimum?: number;
  /** The inclusive upper bound. */
  maximum?: number;
}

function validateIntegerOption(value: number | undefined, name: string): void {
  if (value !== undefined && !Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
}

/** Defines a base-10 safe integer with optional inclusive bounds and default. */
export function environmentInteger(name: string, options: IntegerEnvironmentOptions = {}): EnvironmentField<number> {
  validateIntegerOption(options.defaultValue, "defaultValue");
  validateIntegerOption(options.minimum, "minimum");
  validateIntegerOption(options.maximum, "maximum");

  if (options.minimum !== undefined && options.maximum !== undefined && options.minimum > options.maximum) {
    throw new RangeError("minimum cannot exceed maximum");
  }
  if (
    options.defaultValue !== undefined &&
    ((options.minimum !== undefined && options.defaultValue < options.minimum) ||
      (options.maximum !== undefined && options.defaultValue > options.maximum))
  ) {
    throw new RangeError("defaultValue must satisfy the configured bounds");
  }

  return field(name, (rawValue) => {
    if (rawValue === undefined && options.defaultValue !== undefined) return options.defaultValue;
    if (rawValue === undefined || !/^-?\d+$/.test(rawValue)) return invalidValue();

    const value = Number(rawValue);
    if (
      !Number.isSafeInteger(value) ||
      (options.minimum !== undefined && value < options.minimum) ||
      (options.maximum !== undefined && value > options.maximum)
    ) {
      return invalidValue();
    }

    return value;
  });
}

/** Parses an application config and reports every invalid variable without including private values. */
export function parseEnvironment<const Schema extends EnvironmentSchema>(
  source: EnvironmentSource,
  schema: Schema
): EnvironmentOutput<Schema> {
  const output: Partial<EnvironmentOutput<Schema>> = {};
  const invalidFields: string[] = [];

  for (const [key, publicField] of Object.entries(schema)) {
    const definition = publicField as EnvironmentFieldDefinition<unknown>;
    try {
      Reflect.set(output, key, definition.parse(source[definition.name]));
    } catch (error) {
      if (error !== invalidEnvironmentValue) throw error;
      invalidFields.push(definition.name);
    }
  }

  if (invalidFields.length > 0) {
    throw new EnvironmentValidationError(invalidFields);
  }

  return output as EnvironmentOutput<Schema>;
}
