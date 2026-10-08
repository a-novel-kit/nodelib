import { JSDOM } from "jsdom";
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
        const query = new URLSearchParams({ query: `to:"${email}"`, limit: "10" });
        const search = await read(`${mailpit}/api/v1/search?${query}`);
        for (const id of messageIds(search)) {
          const href = links(messageHtml(await read(`${mailpit}/api/v1/message/${id}`))).find(
            (candidate) => new URL(candidate).pathname === pathname
          );
          if (href) {
            expect(new URL(href).origin).toBe(origin);
            link = href;
            return true;
          }
        }
        return false;
      },
      { timeout, message: `Email containing ${pathname} delivered to ${email}` }
    )
    .toBe(true);

  if (!link) throw new Error(`No link to ${pathname} delivered to ${email}`);
  return link;
}

async function read(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mailpit answered ${response.status} for ${url}`);
  return response.json();
}

function messageIds(search: unknown): string[] {
  const messages = (search as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) throw new TypeError("Mailpit search has no messages list");
  return messages.map((message: { ID?: unknown }) => {
    if (typeof message.ID !== "string") throw new TypeError("Mailpit message has no ID");
    return message.ID;
  });
}

function messageHtml(message: unknown): string {
  const html = (message as { HTML?: unknown }).HTML;
  if (typeof html !== "string") throw new TypeError("Mailpit message has no HTML body");
  return html;
}

function links(html: string): string[] {
  const dom = new JSDOM(html);
  const hrefs = Array.from(dom.window.document.querySelectorAll<HTMLAnchorElement>("a[href]"), (anchor) => anchor.href);
  dom.window.close();
  return hrefs;
}
