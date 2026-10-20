import { isHttpStatusError } from "@a-novel-kit/nodelib-browser/http";

/** Prints a settled value for a failure message, as JSON when it serializes. */
function prettyRes(res: unknown): string {
  try {
    return JSON.stringify(res, null, 2);
  } catch {
    return String(res);
  }
}

/**
 * expectStatus awaits the given promise and asserts that it rejects with an HTTP error carrying the
 * given status code, throwing a descriptive failure otherwise.
 */
export async function expectStatus(promise: Promise<unknown>, status: number): Promise<void> {
  const res = await promise.catch((err: unknown) => err);

  if (!isHttpStatusError(res, status)) {
    throw new Error(`expected error with status ${status}, got: ${prettyRes(res)}`);
  }
}
