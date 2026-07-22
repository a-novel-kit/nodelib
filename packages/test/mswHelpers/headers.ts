import { HttpResponse } from "msw";

/**
 * Matches the request's headers against `expect`, or defers to `expect` when it is a predicate.
 *
 * The request must carry every header in `expect` with an equal value; headers present only on the request are
 * ignored.
 */
export const matchHeaders = async (
  request: Request,
  expect: Headers | ((req: Headers) => Promise<boolean | HttpResponse<any>>)
): Promise<boolean | HttpResponse<any>> => {
  if (typeof expect === "function") {
    return (expect as (req: Headers) => Promise<boolean | HttpResponse<any>>)(request.headers);
  }

  // Headers keeps its data in internal slots, so only its own iterator exposes the entries; a
  // generic object walk sees an empty list and the matcher accepts every request.
  for (const [key, value] of expect.entries()) {
    if (request.headers.get(key) !== value) {
      return false;
    }
  }
  return true;
};
