/** Where the browser keeps a cookie that several apps may share. */
export interface CookieOptions {
  /**
   * Names the domain every app that shares the cookie runs under, as `storyverse.fr`. Without it,
   * the cookie stays with the current host.
   */
  domain?: string;
}

/**
 * Keeps a value that every page reads and the server receives, for `maxAge` seconds. A browser that
 * refuses cookies forgets it with the page.
 */
export function writeCookie(name: string, value: string, maxAge: number, { domain }: CookieOptions = {}): void {
  if (typeof document === "undefined") return;

  const attributes = [`Path=/`, `Max-Age=${maxAge}`, "SameSite=Lax"];
  if (domain) attributes.push(`Domain=${domain}`);
  if (location.protocol === "https:") attributes.push("Secure");

  document.cookie = [`${name}=${value}`, ...attributes].join("; ");
}
