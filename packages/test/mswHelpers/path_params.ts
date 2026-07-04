import { isEqual } from "lodash-es";
import { HttpResponse, PathParams } from "msw";

/**
 * Matches the route's path parameters against `expect`, or defers to `expect` when it is a predicate.
 *
 * Every parameter in `expect` must equal the resolved parameter of the same name; parameters present only on the
 * route are ignored.
 */
export const matchPathParams = async (
  params: PathParams,
  expect: PathParams | ((req: PathParams) => Promise<boolean | HttpResponse<any>>)
): Promise<boolean | HttpResponse<any>> => {
  if (typeof expect === "function") {
    return (expect as (req: PathParams) => Promise<boolean | HttpResponse<any>>)(params);
  }

  for (const [key, value] of Object.entries(expect)) {
    if (!isEqual(params[key], value)) {
      return false;
    }
  }

  return true;
};
