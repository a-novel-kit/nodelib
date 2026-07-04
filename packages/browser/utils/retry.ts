/**
 * A RetryFailureFn produces the final result once retrying gives up. It receives the last error
 * and the arguments the call was made with, and either returns a fallback value or throws.
 */
export type RetryFailureFn<T, Params extends unknown[]> = (error: unknown, ...params: Params) => T;

function defaultRetryFailureFn<T, Params extends unknown[]>(err: unknown, ..._: Params): T {
  throw err;
}

/** RetryParams tunes {@link retry}: the attempt budget, the pause between attempts, and how a terminal failure is handled. */
export interface RetryParams<T, Params extends unknown[]> {
  /**
   * Total number of attempts (including the initial attempt) before failing.
   * @default 3
   */
  retries?: number;
  /**
   * Delay between retries in milliseconds.
   * @default 1000
   */
  delay?: number;
  /**
   * Called once every attempt is exhausted (or once `condition` rejects an error). Rethrows the
   * last error by default.
   */
  onFailure?: RetryFailureFn<T, Params>;
  /**
   * Decides whether a thrown error is retryable. Returning false stops retrying at once and defers
   * to `onFailure`. Every error is retried by default.
   */
  condition?: (err: unknown) => boolean;
}

/**
 * Wraps a callback so failed invocations are transparently retried. The returned function retries
 * on each thrown error until the callback succeeds, the attempt budget runs out, or an error is
 * marked non-retryable, at which point it defers to the failure handler.
 */
export function retry<T, Params extends unknown[]>(
  callback: (...params: Params) => T | Promise<T>,
  {
    retries = 3,
    delay = 1000,
    onFailure = defaultRetryFailureFn<T, Params>,
    condition = () => true,
  }: RetryParams<T, Params> = {}
): (...params: Params) => Promise<T> {
  return async function doRetry(...params: Params): Promise<T> {
    let err: unknown;

    for (let i = 0; i < retries; i++) {
      try {
        return await callback(...params);
      } catch (error) {
        if (!condition(error)) {
          return onFailure(error, ...params);
        }

        err = error;
        // Don't delay after final attempt.
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return onFailure(err, ...params);
  };
}
