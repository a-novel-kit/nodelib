import { Debounce } from "./debounce";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the function", () => {
    const callback = vi.fn();

    new Debounce(10).call(callback);

    expect(callback).toHaveBeenCalledOnce();
  });

  it("calls the function multiple times", () => {
    const callback = vi.fn();
    const debouncer = new Debounce(10);

    debouncer.call(callback);
    vi.advanceTimersByTime(20);
    debouncer.call(callback);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("cancels the call", () => {
    const callback = vi.fn();
    const debouncer = new Debounce(10);

    debouncer.call(callback);
    vi.advanceTimersByTime(5);
    debouncer.call(callback); // This call is delayed for debouncing.
    expect(callback).toHaveBeenCalledTimes(1);
    debouncer.cancel();
    vi.advanceTimersByTime(20);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores calls that are too close", () => {
    const callback = vi.fn();
    const debouncer = new Debounce(10);

    debouncer.call(callback);
    debouncer.call(callback); // The next call supersedes this one.
    vi.advanceTimersByTime(5);
    debouncer.call(callback); // This call is delayed for debouncing.
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20);

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
