import { TELEMETRY_CONSENT_COOKIE, parseTelemetryChoice, readTelemetryChoice, saveTelemetryChoice } from "./consent";

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = `${TELEMETRY_CONSENT_COOKIE}=; Path=/; Max-Age=0`;
});

describe("parseTelemetryChoice", () => {
  it.each([
    { name: "reads an acceptance", value: "accepted", want: "accepted" },
    { name: "reads a refusal", value: "declined", want: "declined" },
    { name: "ignores an unknown choice", value: "maybe", want: undefined },
    { name: "asks a visitor who never answered", value: undefined, want: undefined },
  ])("$name", ({ value, want }) => {
    expect(parseTelemetryChoice(value)).toBe(want);
  });
});

describe("readTelemetryChoice", () => {
  it("reads the choice among other cookies", () => {
    document.cookie = "theme=dark; Path=/";
    document.cookie = `${TELEMETRY_CONSENT_COOKIE}=declined; Path=/`;

    expect(readTelemetryChoice()).toBe("declined");
  });

  it("asks again after a new banner version", () => {
    document.cookie = "telemetry-consent-v0=accepted; Path=/";

    expect(readTelemetryChoice()).toBeUndefined();
  });
});

describe("saveTelemetryChoice", () => {
  it("keeps the choice for six months", () => {
    const write = vi.spyOn(document, "cookie", "set");

    saveTelemetryChoice("accepted");

    expect(readTelemetryChoice()).toBe("accepted");
    expect(write).toHaveBeenCalledWith(`${TELEMETRY_CONSENT_COOKIE}=accepted; Path=/; Max-Age=15724800; SameSite=Lax`);
  });

  it("shares the choice with every host of a domain", () => {
    const write = vi.spyOn(document, "cookie", "set");

    saveTelemetryChoice("declined", { domain: "storyverse.fr" });

    expect(write).toHaveBeenCalledWith(expect.stringContaining("; Domain=storyverse.fr"));
  });
});
