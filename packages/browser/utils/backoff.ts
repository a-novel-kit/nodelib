/** RetryBackoffOptions spaces the attempts of {@link retryWithBackoff} and bounds them. */
export interface RetryBackoffOptions {
  /**
   * Milliseconds before the first retry. Each retry doubles the wait.
   * @default 5000
   */
  initialDelay?: number;
  /**
   * Longest wait in milliseconds: the steady rhythm the doubling settles at.
   * @default 180000
   */
  maxDelay?: number;
  /**
   * Retries before giving up. Data the page cannot do without keeps the default, and retries until
   * its owner stops the run.
   * @default Infinity
   */
  maxRetries?: number;
  /** Runs once when a bounded run has spent its last retry. */
  onExhausted?: () => void;
}

/**
 * Repeats a read that failed, on an exponential backoff, until the returned function stops it. The
 * owner of the data stops the run once the data arrives, so an attempt only has to ask again. An
 * attempt must be idempotent, and a rejected attempt counts as one more retry.
 *
 * A run holds one timer at a time, and stopping it clears that timer, so a stopped run keeps nothing
 * alive. An attempt in flight when the run stops schedules nothing. Tie the stop to the owner's
 * lifetime, as an `$effect` teardown does.
 */
export function retryWithBackoff(
  attempt: () => Promise<unknown>,
  { initialDelay = 5_000, maxDelay = 180_000, maxRetries = Infinity, onExhausted }: RetryBackoffOptions = {}
): () => void {
  let retries = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  function wait() {
    timer = setTimeout(run, Math.min(initialDelay * 2 ** retries, maxDelay));
  }

  async function run() {
    retries += 1;

    try {
      await attempt();
    } catch {
      // The next retry asks again. The owner decides what a failure shows.
    }

    if (stopped) return;
    if (retries < maxRetries) wait();
    else onExhausted?.();
  }

  wait();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
