// @vitest-environment node
import { mailLinks, searchMail } from "./reader";

import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const messages = {
  newest: { ID: "newest", Subject: "Create your account", HTML: '<a href="http://app.test/ext">Create</a>' },
  oldest: { ID: "oldest", Subject: "Welcome", HTML: "<p>Welcome</p>" },
};

let server: Server;
let mailpit: string;
const searches: URLSearchParams[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    response.setHeader("Content-Type", "application/json");
    if (url.pathname === "/api/v1/search") {
      searches.push(url.searchParams);
      response.end(JSON.stringify({ messages: Object.values(messages).map(({ ID }) => ({ ID })) }));
      return;
    }
    const message = messages[url.pathname.replace("/api/v1/message/", "") as keyof typeof messages];
    if (message === undefined) response.statusCode = 404;
    response.end(JSON.stringify(message ?? {}));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  mailpit = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchMail", () => {
  it("reads every message the search matches, in Mailpit's order", async () => {
    await expect(searchMail(mailpit, 'to:"someone@example.test"', 2)).resolves.toEqual([
      messages.newest,
      messages.oldest,
    ]);
    expect(Object.fromEntries(searches.at(-1) ?? [])).toEqual({ query: 'to:"someone@example.test"', limit: "2" });
  });

  it("releases the body of an error status", async () => {
    const response = new Response("unavailable", { status: 503 });
    vi.stubGlobal("fetch", async () => response);

    await expect(searchMail(mailpit, "to:someone")).rejects.toThrow("Mailpit answered 503");
    expect(response.bodyUsed).toBe(true);
  });
});

describe("mailLinks", () => {
  it("lists the links of an HTML body with their entities decoded", () => {
    const html = '<a href="http://app.test/a?x=1&amp;y=2">A</a><p>text</p><a href="http://app.test/b">B</a>';
    expect(mailLinks(html)).toEqual(["http://app.test/a?x=1&y=2", "http://app.test/b"]);
  });
});
