import { Debounce } from "./debounce";

import { describe, expect, it, vi } from "vitest";

describe("debounce", () => {
  it("calls the function", async () => {
    const callback = vi.fn();

    const debouncer = new Debounce(10);

    debouncer.call(callback);

    expect(callback).toHaveBeenCalledOnce();
  });

  it("calls the function multiple times", async () => {
    const callback = vi.fn();

    const debouncer = new Debounce(10);

    debouncer.call(callback);
    await new Promise((resolve) => setTimeout(resolve, 20));
    debouncer.call(callback);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("cancels the call", async () => {
    const callback = vi.fn();

    const debouncer = new Debounce(10);
    debouncer.call(callback);
    await new Promise((resolve) => setTimeout(resolve, 5));
    debouncer.call(callback); // This call is delayed for debouncing.
    expect(callback).toHaveBeenCalledTimes(1);
    debouncer.cancel();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores calls that are too close", async () => {
    const callback = vi.fn();

    const debouncer = new Debounce(10);

    debouncer.call(callback);
    debouncer.call(callback); // This call is ignored, because of the one that comes right after.
    await new Promise((resolve) => setTimeout(resolve, 5));
    debouncer.call(callback); // This call is delayed for debouncing.
    expect(callback).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
