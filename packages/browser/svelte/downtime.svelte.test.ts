import { createPlatformDowntime } from "./downtime.svelte";

import { flushSync } from "svelte";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const now = new Date("2026-01-12T06:00:00Z");

/** A downtime of the authentication database starting `delay` milliseconds from now. */
function downtime(delay: number) {
  return {
    components: ["service-authentication.database"],
    start: new Date(now.getTime() + delay),
    end: new Date(now.getTime() + delay + 3_600_000),
  };
}

describe("createPlatformDowntime", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads the downtime and its start from the load", () => {
    const load = { downtime: downtime(-1000), downtimeStarted: true };
    let tracked: ReturnType<typeof createPlatformDowntime> | undefined;
    const destroy = $effect.root(() => {
      tracked = createPlatformDowntime(() => load);
    });
    flushSync();

    expect(tracked?.downtime).toBe(load.downtime);
    expect(tracked?.started).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    destroy();
  });

  it("starts once the start passes under a page left open", async () => {
    const onStart = vi.fn();
    let tracked: ReturnType<typeof createPlatformDowntime> | undefined;
    const destroy = $effect.root(() => {
      tracked = createPlatformDowntime(() => ({ downtime: downtime(60_000), downtimeStarted: false }), onStart);
    });
    flushSync();

    await vi.advanceTimersByTimeAsync(59_999);
    expect(tracked?.started).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(tracked?.started).toBe(true);
    expect(onStart).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);

    destroy();
  });

  it.each([
    { name: "waits for no downtime", downtime: null },
    { name: "waits for no start past the longest timer", downtime: downtime(2 ** 31) },
  ])("$name", ({ downtime }) => {
    const destroy = $effect.root(() => void createPlatformDowntime(() => ({ downtime, downtimeStarted: false })));
    flushSync();

    expect(vi.getTimerCount()).toBe(0);

    destroy();
  });

  it("drops its timer once its owner is gone", () => {
    const destroy = $effect.root(
      () => void createPlatformDowntime(() => ({ downtime: downtime(60_000), downtimeStarted: false }))
    );
    flushSync();
    expect(vi.getTimerCount()).toBe(1);

    destroy();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows times in UTC until it runs in the visitor's browser", () => {
    // Fake timers replace Intl.DateTimeFormat, so the visitor's zone is stubbed on the global itself.
    const DateTimeFormat = () => ({ resolvedOptions: () => ({ timeZone: "Pacific/Kiritimati" }) });
    vi.stubGlobal("Intl", Object.create(Intl, { DateTimeFormat: { value: DateTimeFormat } }));
    let tracked: ReturnType<typeof createPlatformDowntime> | undefined;
    const destroy = $effect.root(() => {
      tracked = createPlatformDowntime(() => ({ downtime: null, downtimeStarted: false }));
    });

    expect(tracked?.timeZone).toBe("UTC");
    flushSync();
    expect(tracked?.timeZone).toBe("Pacific/Kiritimati");

    destroy();
  });
});
