import { type CookieOptions, writeCookie } from "../cookie.js";
import { PREFERENCE_LIFETIME_S } from "./lifetime.js";

/** How the visitor left the navigation rail: with its labels, or narrowed to its icons. */
export type NavigationRail = "expanded" | "collapsed";

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
  writeCookie(NAVIGATION_RAIL_COOKIE, rail, PREFERENCE_LIFETIME_S, options);
}
