/**
 * HttpError represents a non-2xx HTTP response, keeping the status code and body text
 * so callers can inspect them after the request has failed.
 */
export class HttpError extends Error {
  private readonly _status: number;

  constructor(status: number, text: string) {
    super(`request failed with status ${status}: ${text}`);

    this.name = "HttpError";
    this._status = status;
  }

  get status() {
    return this._status;
  }
}

/**
 * newHttpError builds an HttpError from a failed response, reading its body as text. A body
 * that cannot be decoded is replaced with the decode error message rather than rejecting.
 */
export async function newHttpError(response: Response): Promise<HttpError> {
  const text = await response.text().catch((err) => `failed to decode response: ${err.message}`);
  return new HttpError(response.status, text);
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
