import { expectStatus } from "./err";

import { describe, expect, it } from "vitest";

import { HttpError } from "@a-novel-kit/nodelib-browser/http";

describe("expectStatus", () => {
  it("passes when the promise rejects with the expected status", async () => {
    await expect(expectStatus(Promise.reject(new HttpError(404, "not found")), 404)).resolves.toBeUndefined();
  });

  it.each([
    { name: "another status", settle: () => Promise.reject(new HttpError(500, "internal")) },
    { name: "an error without a status", settle: () => Promise.reject(new TypeError("fetch failed")) },
  ])("fails on $name", async ({ settle }) => {
    await expect(expectStatus(settle(), 404)).rejects.toThrow("expected error with status 404, got: ");
  });

  it("prints the value of a promise that resolves", async () => {
    await expect(expectStatus(Promise.resolve({ id: "item" }), 404)).rejects.toThrow(
      'expected error with status 404, got: {\n  "id": "item"\n}'
    );
  });
});
