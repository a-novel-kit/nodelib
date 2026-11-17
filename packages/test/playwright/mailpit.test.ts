// @vitest-environment node
import { startMailpit } from "../mailpit/server.fixture";
import { emailLink } from "./mailpit";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

let mailpit: Awaited<ReturnType<typeof startMailpit>>;

beforeAll(async () => {
  mailpit = await startMailpit([
    { ID: "other", HTML: '<a href="http://app.test/account">Your account</a>' },
    {
      ID: "invitation",
      HTML: '<a href="http://app.test/ext/account/create?shortCode=a1&amp;target=b2">Create my account</a>',
    },
  ]);
});

afterAll(async () => {
  await mailpit.close();
});

describe("emailLink", () => {
  it("returns the delivered link to the requested path, with its query decoded", async () => {
    await expect(
      emailLink("someone@example.test", "/ext/account/create", { mailpit: mailpit.url, origin: "http://app.test" })
    ).resolves.toBe("http://app.test/ext/account/create?shortCode=a1&target=b2");
  });

  it("fails at once on a matching link that points outside the application under test", async () => {
    await expect(
      emailLink("someone@example.test", "/ext/account/create", { mailpit: mailpit.url, origin: "http://studio.test" })
    ).rejects.toThrow(/Expected: "http:\/\/studio\.test"[^]*Received: "http:\/\/app\.test"/);
  });
});
