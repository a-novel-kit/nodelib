/**
 * Reads the emails a test sends to Mailpit, with no test runner of its own: Playwright journeys and
 * Vitest integration suites poll it the same way.
 */
export * from "./reader.js";
