import { mailLinks, searchMail } from "../mailpit/reader.js";

import { expect } from "playwright/test";

/** Where to read emails, and the only origin an accepted link may point to. */
export interface EmailLinkOptions {
  /** Mailpit's HTTP base, such as `http://127.0.0.1:8025`. */
  mailpit: string;
  /** Origin of the application under test. */
  origin: string;
  /** Delivery deadline in milliseconds. */
  timeout?: number;
}

/**
 * Waits for an email to `email` that links to `pathname`, and returns that link. A matching link to
 * another origin fails, so a journey never follows an email out of the application under test.
 */
export async function emailLink(
  email: string,
  pathname: string,
  { mailpit, origin, timeout = 15_000 }: EmailLinkOptions
): Promise<string> {
  let link: string | undefined;

  await expect
    .poll(
      async () => {
        link = await deliveredLink(mailpit, email, pathname);
        if (link) expect(new URL(link).origin).toBe(origin);
        return link !== undefined;
      },
      { timeout, message: `Email containing ${pathname} delivered to ${email}` }
    )
    .toBe(true);

  if (!link) throw new Error(`No link to ${pathname} delivered to ${email}`);
  return link;
}

/** Finds a link to `pathname` in the latest emails Mailpit holds for `email`. */
async function deliveredLink(mailpit: string, email: string, pathname: string): Promise<string | undefined> {
  const links = (await searchMail(mailpit, `to:"${email}"`)).flatMap(({ HTML }) => mailLinks(HTML));
  return links.find((candidate) => new URL(candidate).pathname === pathname);
}
