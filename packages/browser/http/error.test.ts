import { isDowntimeError, isHttpError, isHttpStatusError, newHttpError } from "./error";

import { describe, expect, it } from "vitest";

describe("HttpError", () => {
  describe("newHttpError", () => {
    it("returns new error from response", async () => {
      const response = new Response("badaboom", { status: 404 });
      const err = await newHttpError(response);

      expect(err.status).toBe(404);
      expect(err.message).toBe("request failed with status 404: badaboom");
    });

    it("catches decoding error", async () => {
      class mockedResponse {
        readonly status = 404;
        readonly headers = new Headers({ "Content-Type": "application/problem+json" });
        async text(): Promise<string> {
          throw new Error("bad");
        }
      }

      const response = new mockedResponse() as Response;
      const err = await newHttpError(response);

      expect(err.status).toBe(404);
      expect(err.message).toBe("request failed with status 404: failed to decode response: bad");
      expect(err.tags).toEqual({});
    });

    it.each([
      {
        name: "reads the tags of a problem details body",
        contentType: "application/problem+json",
        body: { type: "about:blank", status: 422, tags: { invalidFields: { email: "email" }, accountExists: true } },
        expectTags: { invalidFields: { email: "email" }, accountExists: true },
      },
      {
        name: "ignores a JSON body that is not problem details",
        contentType: "application/json",
        body: { tags: { accountExists: true } },
        expectTags: {},
      },
      {
        name: "ignores a problem details body without tags",
        contentType: "application/problem+json",
        body: { type: "about:blank", status: 400 },
        expectTags: {},
      },
      {
        name: "ignores invalid fields of the wrong shape",
        contentType: "application/problem+json",
        body: { tags: { invalidFields: ["email"] } },
        expectTags: {},
      },
    ])("$name", async ({ contentType, body, expectTags }) => {
      const response = new Response(JSON.stringify(body), { status: 422, headers: { "Content-Type": contentType } });
      const err = await newHttpError(response);

      expect(err.status).toBe(422);
      expect(err.tags).toEqual(expectTags);
    });

    it("ignores a problem details body that is not JSON", async () => {
      const response = new Response("{", { status: 400, headers: { "Content-Type": "application/problem+json" } });
      const err = await newHttpError(response);

      expect(err.tags).toEqual({});
    });
  });

  describe("isHttpError", () => {
    it("catches HttpError", async () => {
      const response = new Response("badaboom", { status: 404 });
      const err = await newHttpError(response);

      expect(isHttpError(err)).toBeTruthy();
    });

    it("doesn't catch other errors", () => {
      const err = new TypeError("not an HttpError");
      expect(isHttpError(err)).toBeFalsy();
    });
  });

  describe("isHttpStatusError", () => {
    it("catches HttpError with correct status", async () => {
      const response = new Response("badaboom", { status: 404 });
      const err = await newHttpError(response);

      expect(isHttpStatusError(err, 401, 404)).toBeTruthy();
    });

    it("doesn't catch HttpError with incorrect status", async () => {
      const response = new Response("badaboom", { status: 500 });
      const err = await newHttpError(response);

      expect(isHttpStatusError(err, 401, 404)).toBeFalsy();
    });

    it("doesn't catch other errors", () => {
      const err = new TypeError("not an HttpError");
      expect(isHttpStatusError(err, 401, 404)).toBeFalsy();
    });
  });

  describe("isDowntimeError", () => {
    const refusal = { type: "about:blank", title: "Service Unavailable", status: 503, tags: { downtime: true } };

    it.each([
      { name: "catches a planned downtime refusal", status: 503, body: refusal, expected: true },
      { name: "doesn't catch an outage", status: 503, body: { ...refusal, tags: {} }, expected: false },
      { name: "doesn't catch another status", status: 500, body: refusal, expected: false },
    ])("$name", async ({ status, body, expected }) => {
      const response = new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/problem+json" },
      });

      expect(isDowntimeError(await newHttpError(response))).toBe(expected);
    });

    it("doesn't catch other errors", () => {
      expect(isDowntimeError(new TypeError("not an HttpError"))).toBe(false);
    });

    it("doesn't fail on an HttpError from a copy that predates tags", () => {
      const error = Object.assign(new Error("request failed with status 503"), { name: "HttpError", status: 503 });

      expect(isDowntimeError(error)).toBe(false);
    });
  });
});
