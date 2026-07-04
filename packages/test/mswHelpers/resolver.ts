import { HttpResponse, HttpResponseResolver } from "msw";

/**
 * A predicate run against an incoming request before its handler responds.
 *
 * The result drives a three-way decision: `false` leaves the request unhandled so it falls through to any
 * other handler, `true` accepts it and moves on to the next matcher, and returning an `HttpResponse`
 * short-circuits the chain to answer immediately — typically to surface a failed expectation.
 */
export type ResolverFn = (...args: Parameters<HttpResponseResolver>) => Promise<boolean | HttpResponse<any>>;
