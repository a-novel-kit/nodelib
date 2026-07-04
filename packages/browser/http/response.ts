import { newHttpError } from "./error";

import type { ZodType } from "zod";

/**
 * handleHttpResponse passes an ok (2xx) response through unchanged and throws an HttpError for
 * any other status.
 */
export async function handleHttpResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    throw await newHttpError(response);
  }
  return response;
}

/**
 * decodeHttpResponse builds a response handler that parses the JSON body and validates it against
 * the given Zod schema, resolving to the typed value or rejecting on a validation failure.
 */
export function decodeHttpResponse<T>(validator: ZodType<T>) {
  return async function (response: Response): Promise<T> {
    const data = await response.json();
    return validator.parseAsync(data);
  };
}
