import { type CookieOptions, writeCookie } from "../cookie.js";

/** How the visitor left the navigation rail: with its labels, or narrowed to its icons. */
export type NavigationRail = "expanded" | "collapsed";

// Browsers keep a cookie 400 days at most (RFC 6265bis), so a year holds in every one.
const RAIL_LIFETIME_S = 365 * 24 * 60 * 60;

/**
 * Names the cookie that keeps the rail. A server reads it to render the rail the visitor left, so the
 * page never shows the other one first.
 */
export const NAVIGATION_RAIL_COOKIE = "navigation-rail";

/** Reads the rail from the cookie's value. The rail stays expanded unless the visitor collapsed it. */
export function parseNavigationRail(value: string | undefined): NavigationRail {
  return value === "collapsed" ? "collapsed" : "expanded";
}

/** Keeps the rail in a cookie for a year. */
export function saveNavigationRail(rail: NavigationRail, options?: CookieOptions): void {
  writeCookie(NAVIGATION_RAIL_COOKIE, rail, RAIL_LIFETIME_S, options);
}
