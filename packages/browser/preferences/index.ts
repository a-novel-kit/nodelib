/**
 * Settings the visitor keeps on a device. Each lives in a cookie the server reads, so a page renders
 * it from the start, and every app under one domain can share it.
 */

export type { CookieOptions } from "../cookie.js";
export * from "./language.js";
export * from "./lifetime.js";
export * from "./rail.js";
