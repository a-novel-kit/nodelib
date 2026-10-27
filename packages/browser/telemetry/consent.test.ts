import { readTelemetryChoice, saveTelemetryChoice } from "./consent";

import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 9, 27);
const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("readTelemetryChoice", () => {
  it.each([
    {
      name: "returns a recent choice",
      stored: { version: 1, choice: "declined", expires: NOW + DAY_MS },
      want: "declined",
    },
    {
      name: "asks again once the choice expires",
      stored: { version: 1, choice: "accepted", expires: NOW },
      want: undefined,
    },
    {
      name: "asks again after a new banner version",
      stored: { version: 0, choice: "accepted", expires: NOW + DAY_MS },
      want: undefined,
    },
    {
      name: "ignores an unknown choice",
      stored: { version: 1, choice: "maybe", expires: NOW + DAY_MS },
      want: undefined,
    },
    { name: "ignores an unreadable value", stored: "{", want: undefined },
    { name: "asks a visitor who never answered", stored: undefined, want: undefined },
  ])("$name", ({ stored, want }) => {
    if (stored !== undefined) {
      localStorage.setItem("telemetry-consent", typeof stored === "string" ? stored : JSON.stringify(stored));
    }

    expect(readTelemetryChoice(NOW)).toBe(want);
  });

  it("asks when the browser blocks storage", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(readTelemetryChoice(NOW)).toBeUndefined();
  });
});

describe("saveTelemetryChoice", () => {
  it("keeps the choice for six months", () => {
    saveTelemetryChoice("accepted", NOW);

    expect(readTelemetryChoice(NOW + 181 * DAY_MS)).toBe("accepted");
    expect(readTelemetryChoice(NOW + 183 * DAY_MS)).toBeUndefined();
  });

  it("survives a full storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(() => saveTelemetryChoice("accepted", NOW)).not.toThrow();
  });
});
