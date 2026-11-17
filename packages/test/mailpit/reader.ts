import { JSDOM } from "jsdom";

/** MailpitAddress is a sender or recipient, as Mailpit's message API names it. */
export interface MailpitAddress {
  Name: string;
  Address: string;
}

/** MailpitMessage is one email Mailpit holds, as its message API returns it. */
export interface MailpitMessage {
  ID: string;
  From: MailpitAddress;
  To: MailpitAddress[];
  Subject: string;
  HTML: string;
  Text: string;
}

/**
 * Reads the latest messages Mailpit holds that match `query`, newest first. The query uses Mailpit's
 * search syntax, unencoded, such as `to:"user+tag@example.test"`. It reads once: the caller's test
 * runner polls it until the message arrives, as Playwright's `expect.poll` or Vitest's `vi.waitFor`
 * do.
 */
export async function searchMail(mailpit: string, query: string, limit = 10): Promise<MailpitMessage[]> {
  const search = await read(`${mailpit}/api/v1/search?${new URLSearchParams({ query, limit: String(limit) })}`);
  return (await Promise.all(
    messageIds(search).map((id) => read(`${mailpit}/api/v1/message/${id}`))
  )) as MailpitMessage[];
}

/** Lists the links of an email's HTML body, absolute and with their entities decoded. */
export function mailLinks(html: string): string[] {
  const dom = new JSDOM(html);
  const hrefs = Array.from(dom.window.document.querySelectorAll<HTMLAnchorElement>("a[href]"), (anchor) => anchor.href);
  dom.window.close();
  return hrefs;
}

async function read(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    // An unread body holds its connection until the server closes it.
    await response.body?.cancel();
    throw new Error(`Mailpit answered ${response.status} for ${url}`);
  }

  return await response.json();
}

function messageIds(search: unknown): string[] {
  const messages = (search as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) throw new TypeError("Mailpit search has no messages list");
  return messages.map(messageId);
}

function messageId(message: { ID?: unknown }): string {
  if (typeof message.ID !== "string") throw new TypeError("Mailpit message has no ID");
  return message.ID;
}
