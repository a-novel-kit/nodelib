import "./vitest-offline";

import { describe, expect, it, vi } from "vitest";

const documentUrl = "https://downtime.test/downtime.json";

describe("vitest-offline", () => {
  it("rejects a request no test stubbed and names its URL", async () => {
    await expect(fetch(documentUrl)).rejects.toThrow(`stub fetch to answer ${documentUrl}`);
    await expect(fetch(new Request(documentUrl))).rejects.toThrow(`stub fetch to answer ${documentUrl}`);
  });

  it("restores the rejection once a test unstubs its fetch", async () => {
    vi.stubGlobal("fetch", async () => Response.json(null));
    await expect(fetch(documentUrl)).resolves.toBeInstanceOf(Response);

    vi.unstubAllGlobals();
    await expect(fetch(documentUrl)).rejects.toThrow("tests have no network");
  });
});
