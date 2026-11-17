import type { TelemetryChoice } from "../telemetry/consent.js";
import type { BrowserTelemetry } from "../telemetry/telemetry.js";

import { createContext } from "svelte";

/** TelemetryPreference holds the visitor's answer about browser telemetry, which the Privacy page changes. */
export interface TelemetryPreference {
  /** Returns the visitor's answer, or undefined while they have not answered. */
  readonly choice: TelemetryChoice | undefined;
  /** Records a new answer, and starts or stops the telemetry to match it. */
  choose(choice: TelemetryChoice): void;
}

/**
 * Reads, installs and detects the telemetry preference, which the root layout installs when the
 * platform collects browser telemetry.
 */
export const [getTelemetryPreference, setTelemetryPreference, hasTelemetryPreference] =
  createContext<TelemetryPreference>();

/**
 * Tracks the visitor's telemetry answer. `getChoice` returns the answer the server read from the
 * browser's cookie, so the page shows the same answer before and after it runs in the browser.
 */
export function createTelemetryPreference(
  telemetry: BrowserTelemetry,
  getChoice: () => TelemetryChoice | undefined
): TelemetryPreference {
  // The answer the server read, until the visitor gives another.
  let choice = $derived(getChoice());

  return {
    get choice() {
      return choice;
    },
    choose(next) {
      choice = next;
      void telemetry.choose(next);
    },
  };
}
