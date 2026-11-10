import { retryWithBackoff } from "./backoff";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("doubles the wait until it settles at the steady rhythm", async () => {
    const attempt = vi.fn(async () => {});
    const stop = retryWithBackoff(attempt);

    for (const [retry, delay] of [5, 10, 20, 40, 80, 160, 180, 180, 180].entries()) {
      await vi.advanceTimersByTimeAsync(delay * 1000 - 1);
      expect(attempt).toHaveBeenCalledTimes(retry);

      await vi.advanceTimersByTimeAsync(1);
      expect(attempt).toHaveBeenCalledTimes(retry + 1);
    }

    stop();
  });

  it("gives up after its last retry and tells the owner once", async () => {
    const attempt = vi.fn(async () => {});
    const onExhausted = vi.fn();
    retryWithBackoff(attempt, { initialDelay: 1000, maxRetries: 3, onExhausted });

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 3999);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(onExhausted).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(onExhausted).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps going after a rejected attempt", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("still down");
    });
    const stop = retryWithBackoff(attempt, { initialDelay: 1000 });

    await vi.advanceTimersByTimeAsync(1000 + 2000);
    expect(attempt).toHaveBeenCalledTimes(2);

    stop();
  });

  it("holds one timer at a time, however long it runs", async () => {
    const stop = retryWithBackoff(async () => {}, { initialDelay: 1000, maxDelay: 1000 });

    for (let retry = 0; retry < 50; retry++) {
      await vi.advanceTimersByTimeAsync(1000);
      expect(vi.getTimerCount()).toBe(1);
    }

    stop();
  });

  it("leaves no timer once stopped", () => {
    const attempt = vi.fn(async () => {});
    const stop = retryWithBackoff(attempt);

    stop();

    expect(vi.getTimerCount()).toBe(0);
    expect(attempt).not.toHaveBeenCalled();
  });

  it("schedules nothing when stopped during an attempt", async () => {
    let finish = () => {};
    const attempt = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const onExhausted = vi.fn();
    const stop = retryWithBackoff(attempt, { initialDelay: 1000, maxRetries: 1, onExhausted });

    await vi.advanceTimersByTimeAsync(1000);
    stop();
    finish();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(onExhausted).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
