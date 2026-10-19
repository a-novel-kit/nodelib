import { retry } from "./retry";

import { describe, expect, it, vi } from "vitest";

class FlakyCallback {
  calls: (() => unknown)[];
  calledTimes = 0;

  constructor(...calls: (() => unknown)[]) {
    this.calls = calls;
  }

  call() {
    const call = this.calls.shift();
    if (!call) {
      throw new Error("No more calls left");
    }
    this.calledTimes++;
    return call();
  }
}

/** Builds a callback attempt that throws an error with the given message. */
function fail(message: string) {
  return () => {
    throw new Error(message);
  };
}

describe("retry", () => {
  it("returns immediately on success", async () => {
    const callback = new FlakyCallback(() => "success");
    const retried = retry(callback.call.bind(callback));

    await expect(retried()).resolves.toBe("success");
    expect(callback.calledTimes).toBe(1);
  });

  it("retries on failure", async () => {
    const callback = new FlakyCallback(fail("fail 1"), fail("fail 2"), () => "success");
    const retried = retry(callback.call.bind(callback), {
      retries: 3,
      delay: 10,
    });

    await expect(retried()).resolves.toBe("success");
    expect(callback.calledTimes).toBe(3);
  });

  it("fails after max retries", async () => {
    const callback = new FlakyCallback(fail("fail 1"), fail("fail 2"), fail("fail 3"));
    const retried = retry(callback.call.bind(callback));

    await expect(retried()).rejects.toThrow("fail 3");
    expect(callback.calledTimes).toBe(3);
  });

  describe("options", () => {
    it("respects retries option", async () => {
      function factory() {
        return new FlakyCallback(fail("fail 1"), fail("fail 2"), () => "success");
      }

      const callback = factory();
      const retried = retry(callback.call.bind(callback), {
        retries: 2,
        delay: 10,
      });

      await expect(retried()).rejects.toThrow("fail 2");
      expect(callback.calledTimes).toBe(2);

      const callback2 = factory();
      const retried2 = retry(callback2.call.bind(callback2), {
        retries: 3,
        delay: 10,
      });

      await expect(retried2()).resolves.toBe("success");
      expect(callback2.calledTimes).toBe(3);
    });

    it("calls onFailure option on failure", async () => {
      const callback = new FlakyCallback(fail("fail 1"), fail("fail 2"), fail("fail 3"));
      const onFailure = vi.fn((err: unknown) => `failed: ${(err as Error).message}`);
      const retried = retry(callback.call.bind(callback), {
        retries: 2,
        delay: 10,
        onFailure,
      });

      await expect(retried()).resolves.toBe("failed: fail 2");
      expect(callback.calledTimes).toBe(2);
      expect(onFailure).toHaveBeenCalledTimes(1);
      expect(onFailure).toHaveBeenCalledWith(new Error("fail 2"));
    });

    it("respects condition", async () => {
      const callback = new FlakyCallback(fail("fail 1"), fail("fail 2"), () => "success");
      const retried = retry(callback.call.bind(callback), {
        retries: 3,
        delay: 10,
        condition: (err) => (err as Error).message !== "fail 2",
      });

      await expect(retried()).rejects.toThrow("fail 2");
      expect(callback.calledTimes).toBe(2);
    });
  });
});
