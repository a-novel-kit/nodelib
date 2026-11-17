import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/** A message the stand-in serves, as Mailpit's message API returns it. */
export type FixtureMessage = { ID: string; HTML: string } & Record<string, unknown>;

/**
 * Starts a Mailpit stand-in that matches every search with `messages`, in their order, and serves
 * each one by its ID. It records the parameters of each search.
 */
export async function startMailpit(messages: FixtureMessage[]) {
  const searches: URLSearchParams[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    response.setHeader("Content-Type", "application/json");

    if (url.pathname === "/api/v1/search") {
      searches.push(url.searchParams);
      response.end(JSON.stringify({ messages: messages.map(({ ID }) => ({ ID })) }));
      return;
    }

    const message = messages.find(({ ID }) => url.pathname === `/api/v1/message/${ID}`);
    if (!message) response.statusCode = 404;
    response.end(JSON.stringify(message ?? {}));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    searches,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
