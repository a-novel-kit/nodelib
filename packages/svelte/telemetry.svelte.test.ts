import { createTelemetryPreference } from "./telemetry.svelte";

import { flushSync } from "svelte";

import { describe, expect, it, vi } from "vitest";

import type { BrowserTelemetry } from "@a-novel-kit/nodelib-browser/telemetry";

describe("createTelemetryPreference", () => {
  it("shows the server's answer until the visitor gives another, which telemetry follows", () => {
    let served = $state<"accepted" | "declined" | undefined>(undefined);
    const telemetry = { choose: vi.fn(async () => {}) } as unknown as BrowserTelemetry;
    const preference = createTelemetryPreference(telemetry, () => served);

    expect(preference.choice).toBeUndefined();

    preference.choose("accepted");
    expect(preference.choice).toBe("accepted");
    expect(telemetry.choose).toHaveBeenCalledExactlyOnceWith("accepted");

    served = "declined";
    flushSync();
    expect(preference.choice).toBe("declined");
  });
});
