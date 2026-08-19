import { EnvironmentValidationError, environmentHttpUrl, environmentInteger, parseEnvironment } from "./environment";

import { describe, expect, it } from "vitest";

const schema = {
  serviceUrl: environmentHttpUrl("SERVICE_URL"),
  timeoutMs: environmentInteger("TIMEOUT_MS", {
    defaultValue: 2_000,
    minimum: 100,
    maximum: 10_000,
  }),
};

describe("parseEnvironment", () => {
  it("maps private variables to a typed normalized config", () => {
    expect(
      parseEnvironment(
        {
          SERVICE_URL: "https://service.example.test/api/",
          TIMEOUT_MS: "750",
        },
        schema
      )
    ).toEqual({
      serviceUrl: "https://service.example.test/api",
      timeoutMs: 750,
    });
  });

  it("uses defaults for absent optional variables", () => {
    expect(parseEnvironment({ SERVICE_URL: "http://service:8080" }, schema)).toEqual({
      serviceUrl: "http://service:8080",
      timeoutMs: 2_000,
    });
  });

  it("reports stable field names without retaining private values", () => {
    const privateValue = "https://user:password@service.example.test";

    expect(() =>
      parseEnvironment(
        {
          SERVICE_URL: privateValue,
          TIMEOUT_MS: "99",
        },
        schema
      )
    ).toThrowError(
      expect.objectContaining<Partial<EnvironmentValidationError>>({
        fields: ["SERVICE_URL", "TIMEOUT_MS"],
        message: "Invalid server environment: SERVICE_URL, TIMEOUT_MS",
      })
    );

    try {
      parseEnvironment({ SERVICE_URL: privateValue, TIMEOUT_MS: "99" }, schema);
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(privateValue);
    }
  });
});

describe("environment fields", () => {
  it.each([
    "ftp://service.example.test",
    "https://user:password@service.example.test",
    "https://service.example.test?token=private",
    "https://service.example.test#private",
  ])("rejects an unsafe service URL: %s", (serviceUrl) => {
    expect(() => parseEnvironment({ SERVICE_URL: serviceUrl }, schema)).toThrow(EnvironmentValidationError);
  });

  it("rejects an invalid integer definition before reading an environment", () => {
    expect(() => environmentInteger("TIMEOUT_MS", { minimum: 10, maximum: 1 })).toThrow(RangeError);
    expect(() => environmentInteger("TIMEOUT_MS", { defaultValue: 11, maximum: 10 })).toThrow(RangeError);
  });
});
