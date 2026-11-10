import { retryWithBackoff } from "./backoff";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("doubles the wait from 250ms until it settles at the steady rhythm", async () => {
    const attempt = vi.fn(async () => {});
    const owner = new AbortController();
    const delays = [250, 500, 1000, 2000, 4000, 8000, 16_000, 32_000, 64_000, 128_000, 180_000, 180_000];
    void retryWithBackoff(attempt, { signal: owner.signal });

    for (const [retry, delay] of delays.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(attempt).toHaveBeenCalledTimes(retry);

      await vi.advanceTimersByTimeAsync(1);
      expect(attempt).toHaveBeenCalledTimes(retry + 1);
    }

    owner.abort();
  });

  it("resolves after its last retry, with its signal still live", async () => {
    const attempt = vi.fn(async () => {});
    const owner = new AbortController();
    const settled = vi.fn();
    void retryWithBackoff(attempt, { signal: owner.signal, initialDelay: 1000, maxRetries: 3 }).then(settled);

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 3999);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(owner.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps going after a rejected attempt", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("still down");
    });
    const owner = new AbortController();
    void retryWithBackoff(attempt, { signal: owner.signal, initialDelay: 1000 });

    await vi.advanceTimersByTimeAsync(1000 + 2000);
    expect(attempt).toHaveBeenCalledTimes(2);

    owner.abort();
  });

  it("holds one timer and one listener at a time, however long it runs", async () => {
    const owner = new AbortController();
    const added = vi.spyOn(owner.signal, "addEventListener");
    const removed = vi.spyOn(owner.signal, "removeEventListener");
    void retryWithBackoff(async () => {}, { signal: owner.signal, initialDelay: 1000, maxDelay: 1000 });

    for (let retry = 1; retry <= 50; retry++) {
      await vi.advanceTimersByTimeAsync(1000);
      expect(vi.getTimerCount()).toBe(1);
      expect(added.mock.calls.length - removed.mock.calls.length).toBe(1);
    }

    owner.abort();
  });

  it("resolves at once and leaves nothing behind when aborted during a wait", async () => {
    const attempt = vi.fn(async () => {});
    const owner = new AbortController();
    const added = vi.spyOn(owner.signal, "addEventListener");
    const removed = vi.spyOn(owner.signal, "removeEventListener");
    const settled = vi.fn();
    void retryWithBackoff(attempt, { signal: owner.signal }).then(settled);

    owner.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(settled).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(attempt).not.toHaveBeenCalled();
    expect(removed).toHaveBeenCalledTimes(added.mock.calls.length);
  });

  it("starts nothing more when aborted during an attempt", async () => {
    let finish = () => {};
    const attempt = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const owner = new AbortController();
    const settled = vi.fn();
    void retryWithBackoff(attempt, { signal: owner.signal, initialDelay: 1000 }).then(settled);

    await vi.advanceTimersByTimeAsync(1000);
    owner.abort();
    finish();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never attempts on a signal already aborted", async () => {
    const attempt = vi.fn(async () => {});

    await retryWithBackoff(attempt, { signal: AbortSignal.abort() });

    expect(attempt).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
