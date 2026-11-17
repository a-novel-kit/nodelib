import { type CookieOptions, writeCookie } from "../cookie.js";

/**
 * How long a device keeps a preference, in seconds. Browsers keep a cookie 400 days at most
 * (RFC 6265bis), so a year holds in every one.
 */
export const PREFERENCE_LIFETIME_S = 365 * 24 * 60 * 60;

/** Keeps a preference in the cookie `name` for a year. The server reads it to render the page as the visitor left it. */
export function savePreference(name: string, value: string, options?: CookieOptions): void {
  writeCookie(name, value, PREFERENCE_LIFETIME_S, options);
}
