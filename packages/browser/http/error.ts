import { z } from "zod";

/**
 * ProblemSchema reads the public tags of an RFC 9457 problem details body. A tag the schema does
 * not name keeps its raw JSON value.
 */
const ProblemSchema = z.object({
  tags: z.looseObject({
    /** invalidFields maps each rejected request field to the validation rule it broke. */
    invalidFields: z.record(z.string(), z.string()).optional(),
  }),
});

/**
 * ProblemTags holds the tags a server attached to an error response for the client to act on.
 */
export type ProblemTags = z.infer<typeof ProblemSchema>["tags"];

/**
 * HttpError represents a non-2xx HTTP response, keeping the status code and body text
 * so callers can inspect them after the request has failed.
 */
export class HttpError extends Error {
  private readonly _status: number;
  private readonly _tags: ProblemTags;

  constructor(status: number, text: string, tags: ProblemTags = {}) {
    super(`request failed with status ${status}: ${text}`);

    this.name = "HttpError";
    this._status = status;
    this._tags = tags;
  }

  get status() {
    return this._status;
  }

  /**
   * tags holds the tags of a problem details body, and is empty for any other body.
   */
  get tags() {
    return this._tags;
  }
}

/**
 * newHttpError builds an HttpError from a failed response, reading its body as text. It always
 * resolves: a body that cannot be decoded is replaced with the decode error message.
 */
export async function newHttpError(response: Response): Promise<HttpError> {
  const text = await response.text().catch((err) => `failed to decode response: ${err.message}`);
  return new HttpError(response.status, text, problemTags(response.headers, text));
}

/**
 * problemTags reads the tags of a problem details body, or returns none for any other body.
 */
function problemTags(headers: Headers, text: string): ProblemTags {
  if (!headers.get("Content-Type")?.startsWith("application/problem+json")) {
    return {};
  }

  try {
    return ProblemSchema.parse(JSON.parse(text)).tags;
  } catch {
    return {};
  }
}

/**
 * isHttpError narrows an unknown error to an HttpError.
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && error.name === "HttpError";
}

/**
 * isHttpStatusError reports whether the error is an HttpError carrying one of the given status codes.
 */
export function isHttpStatusError(error: unknown, ...status: number[]): boolean {
  return isHttpError(error) && status.includes(error.status);
}
