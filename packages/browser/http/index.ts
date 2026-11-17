/**
 * Browser-side helpers for fetch requests: a base for each service's REST client, typed errors for
 * failed responses, and JSON bodies decoded through a Zod schema.
 */
export * from "./client.js";
export { HttpError, type ProblemTags, isDowntimeError, isHttpError, isHttpStatusError } from "./error.js";
export * from "./headers.js";
export * from "./response.js";
