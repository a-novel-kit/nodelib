import { HttpResponse } from "msw";

/**
 * Matches the request URL's query parameters against `expect`, or defers to `expect` when it is a predicate.
 *
 * Every parameter in `expect` must be present with matching values, compared order-insensitively for repeated keys.
 * By default extra query parameters are allowed; pass `strict` to also reject any parameter absent from `expect`.
 */
export const matchSearchParams = async (
  request: Request,
  expect: URLSearchParams | ((req: URLSearchParams) => Promise<boolean | HttpResponse<any>>),
  strict?: boolean
): Promise<boolean | HttpResponse<any>> => {
  const url = new URL(request.url);

  if (typeof expect === "function") {
    return (expect as (req: URLSearchParams) => Promise<boolean | HttpResponse<any>>)(url.searchParams);
  }

  for (const expectKey of expect.keys()) {
    if (!url.searchParams.has(expectKey)) {
      return false;
    }

    if (expect.getAll(expectKey).sort().join(",") !== url.searchParams.getAll(expectKey).sort().join(",")) {
      return false;
    }
  }

  if (strict) {
    for (const key of url.searchParams.keys()) {
      if (!expect.has(key)) {
        return false;
      }
    }
  }

  return true;
};
