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

/** Waits for a delay, or until the signal aborts. The signal must not have aborted yet. */
function wait(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }

    const timer = setTimeout(finish, delay);
    signal.addEventListener("abort", finish);
  });
}

/**
 * Repeats a read that failed, on an exponential backoff. The promise resolves once the retries run
 * out or `signal` aborts, and the caller reads `signal.aborted` to tell them apart. The owner of the
 * data aborts the run once the data arrives, so an attempt only has to ask again. An attempt must be
 * idempotent, and a rejected attempt counts as one more retry.
 *
 * A run holds one timer and one abort listener at a time, and aborting releases both, so an aborted
 * run keeps nothing alive. An attempt in flight when the run aborts starts no other.
 */
export async function retryWithBackoff(
  attempt: () => Promise<unknown>,
  { signal, initialDelay = 250, maxDelay = 180_000, maxRetries = Infinity }: RetryBackoffOptions
): Promise<void> {
  for (let retries = 0; retries < maxRetries && !signal.aborted; retries++) {
    await wait(Math.min(initialDelay * 2 ** retries, maxDelay), signal);
    if (signal.aborted) return;

    try {
      await attempt();
    } catch {
      // The next retry asks again. The owner decides what a failure shows.
    }
  }
}
