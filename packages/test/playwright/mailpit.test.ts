// @vitest-environment node
import { emailLink } from "./mailpit";

import { describe, expect, it, vi } from "vitest";

vi.mock("../mailpit/reader.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../mailpit/reader.js")>()),
  searchMail: async () => [
    { HTML: '<a href="http://app.test/account">Your account</a>' },
    { HTML: '<a href="http://app.test/ext/account/create?shortCode=a1&amp;target=b2">Create my account</a>' },
  ],
}));

const mailpit = "http://mailpit.test";

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
