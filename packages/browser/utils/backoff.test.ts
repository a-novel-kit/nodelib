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
    const run = retryWithBackoff(attempt, { signal: owner.signal });

    for (const [retry, delay] of delays.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(attempt).toHaveBeenCalledTimes(retry);

      await vi.advanceTimersByTimeAsync(1);
      expect(attempt).toHaveBeenCalledTimes(retry + 1);
    }

    owner.abort();
    await expect(run).rejects.toBe(owner.signal.reason);
  });

  it("hands each attempt its signal", async () => {
    const attempt = vi.fn(async (_signal: AbortSignal) => {});
    const owner = new AbortController();

    const run = retryWithBackoff(attempt, { signal: owner.signal, initialDelay: 1000, maxRetries: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    await run;

    expect(attempt).toHaveBeenCalledExactlyOnceWith(owner.signal);
  });

  it("resolves after its last retry when that retry succeeds", async () => {
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
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps going after a rejected attempt", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("still down");
    });
    const owner = new AbortController();
    const run = retryWithBackoff(attempt, { signal: owner.signal, initialDelay: 1000 });

    await vi.advanceTimersByTimeAsync(1000 + 2000);
    expect(attempt).toHaveBeenCalledTimes(2);

    owner.abort();
    await expect(run).rejects.toBe(owner.signal.reason);
  });

  it("rejects with every failure once the retries run out", async () => {
    const failures = [new Error("first"), new Error("second"), new Error("third")];
    const attempt = vi.fn(async () => {
      throw failures[attempt.mock.calls.length - 1];
    });
    const run = retryWithBackoff(attempt, {
      signal: new AbortController().signal,
      initialDelay: 1000,
      maxRetries: 3,
    }).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000);

    const error = await run;
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual(failures);
    expect((error as AggregateError).message).toBe("Operation failed after 3 retries");
  });

  it("forgets the failures before a success", async () => {
    const failure = new Error("back down");
    const attempt = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(failure);
    const run = retryWithBackoff(attempt, {
      signal: new AbortController().signal,
      initialDelay: 1000,
      maxRetries: 3,
    }).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000);

    expect(((await run) as AggregateError).errors).toEqual([failure]);
  });

  it("resolves when only a success follows the failures", async () => {
    const attempt = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce();
    const settled = vi.fn();
    void retryWithBackoff(attempt, {
      signal: new AbortController().signal,
      initialDelay: 1000,
      maxRetries: 2,
    }).then(settled);

    await vi.advanceTimersByTimeAsync(1000 + 2000);

    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("holds one timer and one listener at a time, however long it runs", async () => {
    const owner = new AbortController();
    const added = vi.spyOn(owner.signal, "addEventListener");
    const removed = vi.spyOn(owner.signal, "removeEventListener");
    const run = retryWithBackoff(async () => {}, { signal: owner.signal, initialDelay: 1000, maxDelay: 1000 });

    for (let retry = 1; retry <= 50; retry++) {
      await vi.advanceTimersByTimeAsync(1000);
      expect(vi.getTimerCount()).toBe(1);
      expect(added.mock.calls.length - removed.mock.calls.length).toBe(1);
    }

    owner.abort();
    await expect(run).rejects.toBe(owner.signal.reason);
  });

  it("rejects with the signal's reason, and leaves no timer, when aborted during a wait", async () => {
    const attempt = vi.fn(async () => {});
    const owner = new AbortController();
    const reason = new Error("owner is gone");
    const run = retryWithBackoff(attempt, { signal: owner.signal });

    owner.abort(reason);

    await expect(run).rejects.toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
    expect(attempt).not.toHaveBeenCalled();
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
    const run = retryWithBackoff(attempt, { signal: owner.signal, initialDelay: 1000 });

    await vi.advanceTimersByTimeAsync(1000);
    owner.abort();
    finish();

    await expect(run).rejects.toBe(owner.signal.reason);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with the signal's reason when aborted during its last attempt", async () => {
    const owner = new AbortController();
    const run = retryWithBackoff(
      async (signal) => {
        owner.abort();
        signal.throwIfAborted();
      },
      { signal: owner.signal, initialDelay: 1000, maxRetries: 1 }
    ).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(1000);

    expect(await run).toBe(owner.signal.reason);
  });

  it("never attempts on a signal already aborted", async () => {
    const attempt = vi.fn(async () => {});
    const signal = AbortSignal.abort();

    await expect(retryWithBackoff(attempt, { signal })).rejects.toBe(signal.reason);

    expect(attempt).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
