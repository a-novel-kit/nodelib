// @vitest-environment node
import { mailLinks, searchMail } from "./reader";
import { startMailpit } from "./server.fixture";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const newest = { ID: "newest", Subject: "Create your account", HTML: '<a href="http://app.test/ext">Create</a>' };
const oldest = { ID: "oldest", Subject: "Welcome", HTML: "<p>Welcome</p>" };

let mailpit: Awaited<ReturnType<typeof startMailpit>>;

beforeAll(async () => {
  mailpit = await startMailpit([newest, oldest]);
});

afterAll(async () => {
  await mailpit.close();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchMail", () => {
  it("reads every message the search matches, in Mailpit's order", async () => {
    await expect(searchMail(mailpit.url, 'to:"someone@example.test"', 2)).resolves.toEqual([newest, oldest]);
    expect(Object.fromEntries(mailpit.searches.at(-1) ?? [])).toEqual({
      query: 'to:"someone@example.test"',
      limit: "2",
    });
  });

  it("releases the body of an error status", async () => {
    const response = new Response("unavailable", { status: 503 });
    vi.stubGlobal("fetch", async () => response);

    await expect(searchMail(mailpit.url, "to:someone")).rejects.toThrow("Mailpit answered 503");
    expect(response.bodyUsed).toBe(true);
  });
});

describe("mailLinks", () => {
  it("lists the links of an HTML body with their entities decoded", () => {
    const html = '<a href="http://app.test/a?x=1&amp;y=2">A</a><p>text</p><a href="http://app.test/b">B</a>';
    expect(mailLinks(html)).toEqual(["http://app.test/a?x=1&y=2", "http://app.test/b"]);
  });
});
