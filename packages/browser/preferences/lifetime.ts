/**
 * How long a device keeps a preference, in seconds. Browsers keep a cookie 400 days at most
 * (RFC 6265bis), so a year holds in every one.
 */
export const PREFERENCE_LIFETIME_S = 365 * 24 * 60 * 60;
