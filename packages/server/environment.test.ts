import {
  EnvironmentValidationError,
  environmentHttpUrl,
  environmentInteger,
  environmentOptional,
  parseEnvironment,
} from "./environment";

import { describe, expect, it } from "vitest";

const schema = {
  downtimeUrl: environmentHttpUrl("DOWNTIME_URL", { defaultValue: "https://example.test/downtime.json" }),
  serviceUrl: environmentHttpUrl("SERVICE_URL"),
  tokenPath: environmentOptional("TOKEN_PATH"),
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
          DOWNTIME_URL: "http://127.0.0.1:4180/none.json",
          SERVICE_URL: "https://service.example.test/api/",
          TIMEOUT_MS: "750",
          TOKEN_PATH: "/var/run/token",
        },
        schema
      )
    ).toEqual({
      downtimeUrl: "http://127.0.0.1:4180/none.json",
      serviceUrl: "https://service.example.test/api",
      timeoutMs: 750,
      tokenPath: "/var/run/token",
    });
  });

  it.each([
    { name: "uses defaults for absent optional variables", tokenPath: undefined },
    { name: "reads an empty optional variable as absent", tokenPath: "" },
  ])("$name", ({ tokenPath }) => {
    expect(parseEnvironment({ SERVICE_URL: "http://service:8080", TOKEN_PATH: tokenPath }, schema)).toEqual({
      downtimeUrl: "https://example.test/downtime.json",
      serviceUrl: "http://service:8080",
      timeoutMs: 2_000,
      tokenPath: undefined,
    });
  });

  it("reports stable field names without retaining private values", () => {
    const privateValue = "https://user:password@service.example.test";
    const parse = () => parseEnvironment({ SERVICE_URL: privateValue, TIMEOUT_MS: "99" }, schema);

    expect(parse).toThrowError(
      expect.objectContaining<Partial<EnvironmentValidationError>>({
        fields: ["SERVICE_URL", "TIMEOUT_MS"],
        message: "Invalid server environment: SERVICE_URL, TIMEOUT_MS",
      })
    );

    try {
      parse();
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

  it("rejects an invalid URL default before reading an environment", () => {
    expect(() => environmentHttpUrl("DOWNTIME_URL", { defaultValue: "https://example.test?token=private" })).toThrow(
      RangeError
    );
  });

  it("rejects an invalid integer definition before reading an environment", () => {
    expect(() => environmentInteger("TIMEOUT_MS", { minimum: 10, maximum: 1 })).toThrow(RangeError);
    expect(() => environmentInteger("TIMEOUT_MS", { defaultValue: 11, maximum: 10 })).toThrow(RangeError);
  });
});
