import { decodeHttpResponse, handleHttpResponse } from "./response.js";

import type { ZodType } from "zod";

/** RestInit is a request to a {@link RestClient}, which builds the headers its two shortcuts need. */
export interface RestInit extends RequestInit {
  /** Sends `Authorization: Bearer <accessToken>`. */
  accessToken?: string;
  /** Sends the value as a JSON body, with `Content-Type: application/json`. It replaces `body`. */
  json?: unknown;
}

/**
 * HealthDependency is the state of one upstream dependency, as a service's health endpoint reports
 * it. The endpoint is unauthenticated, so it carries the state alone: the failure itself stays on
 * the service's traces.
 */
export interface HealthDependency {
  status: "up" | "down";
}

/**
 * RestClient sends requests to one service's REST API. Each service's JS client extends it under its
 * own name, as `ProfileApi`, and adds the `ping` and `health` methods of its API version.
 *
 * Every method takes a path under the base URL. Every method except
 * {@link RestClient.fetchResponse} throws an `HttpError` on a non-2xx status.
 */
export class RestClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  /**
   * @param baseUrl - The service's base URL, without a trailing slash.
   * @param fetcher - Sends every request. A server-side caller wraps `fetch` to add the headers its
   *   deployment needs, such as its service token, or to give each request a deadline.
   */
  constructor(baseUrl: string, fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    this.#baseUrl = baseUrl;
    this.#fetch = fetcher;
  }

  /** Sends a request and returns the response whatever its status. The caller reads or cancels its body. */
  async fetchResponse(path: string, init: RestInit = {}): Promise<Response> {
    // Called unbound: browsers reject a native fetch invoked as another object's method.
    const fetcher = this.#fetch;
    return await fetcher(`${this.#baseUrl}${path}`, requestInit(init));
  }

  /** Sends a request and discards the response body. */
  async fetchVoid(path: string, init?: RestInit): Promise<void> {
    const response = await this.fetchResponse(path, init).then(handleHttpResponse);
    // An unread body holds its connection until the server closes it.
    await response.body?.cancel();
  }

  /** Sends a request and decodes the JSON body, validated by the schema when given and trusted as T otherwise. */
  async fetch<T>(path: string, validator?: ZodType<T>, init?: RestInit): Promise<T> {
    const response = await this.fetchResponse(path, init).then(handleHttpResponse);
    return validator ? await decodeHttpResponse(validator)(response) : await response.json();
  }

  /** Sends a request and reads the body as a Blob, typed with the response's `Content-Type`. */
  async fetchBlob(path: string, init?: RestInit): Promise<Blob> {
    const response = await this.fetchResponse(path, init).then(handleHttpResponse);
    return await response.blob();
  }
}

/** Turns the shortcuts of a {@link RestInit} into the headers and body they stand for. */
function requestInit({ accessToken, json, ...init }: RestInit): RequestInit {
  const headers = new Headers(init.headers);
  if (accessToken !== undefined) headers.set("Authorization", `Bearer ${accessToken}`);
  if (json === undefined) return { ...init, headers };

  headers.set("Content-Type", "application/json");
  return { ...init, headers, body: JSON.stringify(json) };
}
