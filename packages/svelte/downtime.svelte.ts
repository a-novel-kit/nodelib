import { createContext } from "svelte";

/**
 * A planned downtime, as nodelib-server's `createDowntimeReader` resolves it. The shape is repeated
 * here so that this package stays independent of the server one.
 */
interface Downtime {
  components: string[];
  start: Date;
  end: Date;
}

/** The planned downtime that stops platform features, as the visitor's page shows it. */
export interface PlatformDowntime {
  /** The downtime, or null without one. */
  readonly downtime: Downtime | null;
  /** Whether it has started, which locks the affected features until operators clear it. */
  readonly started: boolean;
  /** The time zone of its times: UTC until hydration, then the visitor's own. */
  readonly timeZone: string;
}

/** Reads, installs and detects the downtime tracking that the root layout installs for every page. */
export const [getPlatformDowntime, setPlatformDowntime, hasPlatformDowntime] = createContext<PlatformDowntime>();

// setTimeout fires at once past this delay. A page left open that long picks the start up on reload.
const MAX_TIMER_DELAY = 2 ** 31 - 1;

/**
 * Tracks the downtime a load returned. It flips to started once the start passes on the visitor's
 * clock. It moves to the visitor's time zone after hydration, so the server and the first render
 * agree. `onStart` runs when the start passes under a page left open, as SvelteKit's
 * `invalidateAll` reloads the page's data. Call it during component initialization.
 */
export function createPlatformDowntime(
  load: () => { downtime: Downtime | null; downtimeStarted: boolean },
  onStart?: () => void
): PlatformDowntime {
  let reached = $state(false);
  let timeZone = $state("UTC");
  const started = $derived(load().downtimeStarted || reached);

  // Effects run in the browser alone, once the page has hydrated.
  $effect(() => {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  $effect(() => {
    const start = load().downtime?.start;
    if (!start || started) return;

    const delay = start.getTime() - Date.now();
    if (delay > MAX_TIMER_DELAY) return;

    const timer = setTimeout(() => {
      reached = true;
      onStart?.();
    }, delay);
    return () => clearTimeout(timer);
  });

  return {
    get downtime() {
      return load().downtime;
    },
    get started() {
      return started;
    },
    get timeZone() {
      return timeZone;
    },
  };
}
