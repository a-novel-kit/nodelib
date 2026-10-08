// @vitest-environment node
import { emailLink } from "./mailpit";

import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const messages: Record<string, string> = {
  other: '<a href="http://app.test/account">Your account</a>',
  invitation: '<a href="http://app.test/ext/account/create?shortCode=a1&amp;target=b2">Create my account</a>',
};

let server: Server;
let mailpit: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    response.setHeader("Content-Type", "application/json");
    if (url.pathname === "/api/v1/search") {
      response.end(JSON.stringify({ messages: Object.keys(messages).map((ID) => ({ ID })) }));
      return;
    }
    const html = messages[url.pathname.replace("/api/v1/message/", "")];
    if (html === undefined) response.statusCode = 404;
    response.end(JSON.stringify({ HTML: html }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  mailpit = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe("emailLink", () => {
  it("returns the delivered link to the requested path, with its query decoded", async () => {
    await expect(
      emailLink("someone@example.test", "/ext/account/create", { mailpit, origin: "http://app.test" })
    ).resolves.toBe("http://app.test/ext/account/create?shortCode=a1&target=b2");
  });

  it("fails at once on a matching link that points outside the application under test", async () => {
    await expect(
      emailLink("someone@example.test", "/ext/account/create", { mailpit, origin: "http://studio.test" })
    ).rejects.toThrow(/Expected: "http:\/\/studio\.test"[^]*Received: "http:\/\/app\.test"/);
  });
});
