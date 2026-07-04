/**
 * Chainable request matchers layered over msw's `http` handlers.
 *
 * `http` mirrors msw's own `http` object but returns a builder that accumulates assertions on the incoming
 * request — body, headers, path and query parameters — before delegating to the final response resolver. It lets a
 * test say "respond this way only when the request looks like that" without hand-writing the matching logic in every
 * handler.
 */
import { matchBodyBytes, matchBodyFormData, matchBodyJSON, matchBodyText } from "./body";
import { matchHeaders } from "./headers";
import { matchPathParams } from "./path_params";
import { ResolverFn } from "./resolver";
import { matchSearchParams } from "./search_params";

import { HttpRequestHandler, HttpResponse, HttpResponseResolver, RequestHandlerOptions, http as mswHTTP } from "msw";

/**
 * Builder that accumulates request matchers and turns them into a single msw handler. Obtain one through {@link http},
 * chain any number of matchers, then call `resolve` with the response resolver to produce the handler.
 */
class Resolver {
  private readonly handler: HttpRequestHandler;

  private readonly resolvers: ResolverFn[];

  private url: string = "";
  private options?: RequestHandlerOptions;

  constructor(handler: HttpRequestHandler) {
    this.handler = handler;
    this.resolvers = [];
  }

  withURL(url: string): this {
    this.url = url;
    return this;
  }

  withOptions(options?: RequestHandlerOptions): this {
    this.options = options;
    return this;
  }

  /**
   * Registers a raw matcher predicate. When `errorResponse` is given, a non-match responds with it instead of leaving
   * the request unhandled — use it to turn a failed expectation into a visible response rather than a silent
   * pass-through. Every typed matcher below funnels through this method.
   */
  resolver(fn: ResolverFn, errorResponse?: HttpResponse<any>): this {
    if (errorResponse) {
      this.resolvers.push(async (args) => {
        const res = await fn(args);
        return res ? res : errorResponse;
      });
      return this;
    }

    this.resolvers.push(fn);
    return this;
  }

  bodyJSON(expect: Parameters<typeof matchBodyJSON>[1], errorResponse?: HttpResponse<any>) {
    return this.resolver(async ({ request }) => matchBodyJSON(request, expect), errorResponse);
  }
  bodyText(expect: Parameters<typeof matchBodyText>[1], errorResponse?: HttpResponse<any>) {
    return this.resolver(async ({ request }) => matchBodyText(request, expect), errorResponse);
  }
  bodyFormData(expect: Parameters<typeof matchBodyFormData>[1], errorResponse?: HttpResponse<any>) {
    return this.resolver(async ({ request }) => matchBodyFormData(request, expect), errorResponse);
  }
  bodyBytes(expect: Parameters<typeof matchBodyBytes>[1], errorResponse?: HttpResponse<any>) {
    return this.resolver(async ({ request }) => matchBodyBytes(request, expect), errorResponse);
  }

  headers(expect: Parameters<typeof matchHeaders>[1], errorResponse?: HttpResponse<any>) {
    return this.resolver(async ({ request }) => matchHeaders(request, expect), errorResponse);
  }

  params(expect: Parameters<typeof matchPathParams>[1], errorResponse?: HttpResponse<any>) {
    return this.resolver(async ({ params }) => matchPathParams(params, expect), errorResponse);
  }

  searchParams(expect: Parameters<typeof matchSearchParams>[1], strict?: boolean, errorResponse?: HttpResponse<any>) {
    return this.resolver(async ({ request }) => matchSearchParams(request, expect, strict), errorResponse);
  }

  /**
   * Builds the msw handler. Matchers run in registration order: a `false` result leaves the request unhandled, an
   * `HttpResponse` answers immediately, and only once every matcher passes does `resolver` produce the real response.
   */
  resolve(resolver: HttpResponseResolver): ReturnType<typeof this.handler> {
    return this.handler(
      this.url,
      async (args) => {
        for (const fn of this.resolvers) {
          const res = await fn(args);

          if (res === false) {
            return;
          }

          if (res !== true) {
            return res;
          }
        }

        return resolver(args);
      },
      this.options
    );
  }
}

/**
 * Entry point mirroring msw's `http`, with one method per HTTP verb. Each binds a fresh matcher builder to the given
 * URL, ready to chain matchers and finish with `.resolve()`.
 */
export const http = {
  all: (url: string, options?: RequestHandlerOptions) => new Resolver(mswHTTP.all).withURL(url).withOptions(options),
  head: (url: string, options?: RequestHandlerOptions) => new Resolver(mswHTTP.head).withURL(url).withOptions(options),
  get: (url: string, options?: RequestHandlerOptions) => new Resolver(mswHTTP.get).withURL(url).withOptions(options),
  post: (url: string, options?: RequestHandlerOptions) => new Resolver(mswHTTP.post).withURL(url).withOptions(options),
  put: (url: string, options?: RequestHandlerOptions) => new Resolver(mswHTTP.put).withURL(url).withOptions(options),
  delete: (url: string, options?: RequestHandlerOptions) =>
    new Resolver(mswHTTP.delete).withURL(url).withOptions(options),
  patch: (url: string, options?: RequestHandlerOptions) =>
    new Resolver(mswHTTP.patch).withURL(url).withOptions(options),
  options: (url: string, options?: RequestHandlerOptions) =>
    new Resolver(mswHTTP.options).withURL(url).withOptions(options),
};
