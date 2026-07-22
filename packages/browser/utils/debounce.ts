/**
 * Debounce collapses a burst of rapid calls into at most one execution per quiet period. The first
 * call in a burst runs immediately, keeping the response snappy; each further call supersedes the
 * last, and only the final one runs, fired once the calls stop.
 */
export class Debounce {
  private _immediate: boolean;
  private readonly _delay: number;
  private readonly _cooldownReset: number;
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _cooldownTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * @param delay - Milliseconds of quiet required after the last call before the trailing call runs.
   * @param cooldownReset - Milliseconds of quiet after which an incoming call again runs
   *   immediately. Defaults to `delay`.
   */
  constructor(delay: number, cooldownReset: number = delay) {
    this._delay = delay;
    this._cooldownReset = cooldownReset;
    this._immediate = true;
  }

  private _shouldExecuteImmediately(): boolean {
    // Every call restarts the cooldown, so the immediate slot reopens only once calls stop for a
    // full cooldown window.
    clearTimeout(this._cooldownTimer);
    this._cooldownTimer = setTimeout(() => {
      this._cooldownTimer = undefined;
      this._immediate = true;
    }, this._cooldownReset);

    // Only the first call of a burst may skip the delay.
    if (this._immediate) {
      this._immediate = false;
      return true;
    }

    return false;
  }

  /**
   * Cancels a pending trailing execution and resets the debouncer, so the next call runs
   * immediately as if the instance were fresh.
   */
  cancel() {
    clearTimeout(this._timer);
    clearTimeout(this._cooldownTimer);
    this._cooldownTimer = undefined;
    this._immediate = true;
  }

  /**
   * Feeds a call into the debouncer. The function runs immediately when the debouncer is idle,
   * otherwise it is scheduled and supersedes any call still waiting to run.
   */
  call(fn: () => void) {
    clearTimeout(this._timer);
    if (this._shouldExecuteImmediately()) {
      fn();
      return;
    }

    this._timer = setTimeout(fn, this._delay);
  }
}
