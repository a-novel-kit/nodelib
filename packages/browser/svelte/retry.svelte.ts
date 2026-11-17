import { type RetryBackoffOptions, retryWithBackoff } from "../utils/backoff.js";

/** RetryWhileOptions spaces the attempts of {@link retryWhile}, and receives the failure that ends a bounded run. */
export interface RetryWhileOptions extends Omit<RetryBackoffOptions, "signal"> {
  /**
   * Receives the `AggregateError` of a bounded run that spent its retries on failures, such as the
   * platform's telemetry `captureError`. A run without `maxRetries` never fails.
   */
  onError?: (error: unknown) => void;
}

/**
 * Asks for missing data again while `missing` holds, for as long as the calling component lives. The
 * defaults suit data the page cannot do without, which shows a skeleton and retries for good. A list
 * passes `maxRetries`, and shows its error once `exhausted` reads true. Call it during component
 * initialization.
 */
export function retryWhile(
  missing: () => boolean,
  attempt: (signal: AbortSignal) => Promise<unknown>,
  { onError, ...backoff }: RetryWhileOptions = {}
): { readonly exhausted: boolean } {
  // Each load replaces the data `missing` reads. A derived value keeps a load that changed nothing from restarting the backoff.
  const active = $derived(missing());
  let exhausted = $state(false);

  $effect(() => {
    if (!active) return;

    exhausted = false;
    const owner = new AbortController();
    void retryWithBackoff(attempt, { ...backoff, signal: owner.signal })
      .catch((error: unknown) => {
        if (!owner.signal.aborted) onError?.(error);
      })
      .finally(() => {
        exhausted = !owner.signal.aborted;
      });

    return () => owner.abort();
  });

  return {
    get exhausted() {
      return exhausted;
    },
  };
}
