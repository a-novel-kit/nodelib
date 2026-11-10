/** RetryBackoffOptions spaces the attempts of {@link retryWithBackoff} and ends them. */
export interface RetryBackoffOptions {
  /** Ends the run. Tie it to the lifetime of whoever owns the data, as an `$effect` teardown does. */
  signal: AbortSignal;
  /**
   * Milliseconds before the first retry. Each retry doubles the wait.
   * @default 250
   */
  initialDelay?: number;
  /**
   * Longest wait in milliseconds: the steady rhythm the doubling settles at.
   * @default 180000
   */
  maxDelay?: number;
  /**
   * Retries before giving up. Data the page cannot do without keeps the default, and retries until
   * `signal` aborts.
   * @default Infinity
   */
  maxRetries?: number;
}

/** Waits for a delay, and rejects with the signal's reason once the signal aborts. */
function wait(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();

    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }

    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delay);
  });
}

/**
 * Repeats a read that failed, on an exponential backoff. The owner of the data aborts the run once
 * the data arrives, so an attempt only has to ask again. An attempt must be idempotent, and forwards
 * the signal it receives to whatever it can cancel.
 *
 * The promise settles when the run ends:
 *
 * - It rejects with `signal.reason` once `signal` aborts.
 * - It rejects with an `AggregateError` of the failures since the last success when the retries run
 *   out on a failed attempt.
 * - It resolves when the retries run out on a successful attempt.
 *
 * A run holds one timer and one abort listener at a time, and aborting releases both, so an aborted
 * run keeps nothing alive. An attempt in flight when the run aborts starts no other.
 */
export async function retryWithBackoff(
  attempt: (signal: AbortSignal) => Promise<unknown>,
  { signal, initialDelay = 250, maxDelay = 180_000, maxRetries = Infinity }: RetryBackoffOptions
): Promise<void> {
  let failures: unknown[] = [];

  for (let retries = 0; retries < maxRetries; retries++) {
    await wait(Math.min(initialDelay * 2 ** retries, maxDelay), signal);

    try {
      await attempt(signal);
      failures = [];
    } catch (error) {
      // A run without a limit never reports its failures, and may last as long as the page stays open.
      if (Number.isFinite(maxRetries)) failures.push(error);
    }
  }

  // The last attempt has no wait after it to notice an abort.
  signal.throwIfAborted();

  if (failures.length > 0) {
    throw new AggregateError(failures, `Operation failed after ${failures.length} retries`);
  }
}
