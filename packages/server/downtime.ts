/** Downtime is a planned downtime, as operators publish it. */
export interface Downtime {
  /** The components it stops, such as `service-json-keys.database`. */
  components: string[];
  /** When the services of those components start refusing work. */
  start: Date;
  /** When service is expected back. Only clearing the downtime ends it, so it can run past this. */
  end: Date;
}

/** DowntimeReaderOptions locates the published downtime and bounds how it is read. */
export interface DowntimeReaderOptions {
  /** The public document: the downtime as JSON, or `null` without one. */
  url: string | URL;
  /** The fetch implementation. Defaults to the global one. */
  fetch?: typeof globalThis.fetch;
  /**
   * How long one read is reused.
   * @default 60_000
   */
  ttlMs?: number;
  /**
   * The deadline of one request.
   * @default 5_000
   */
  timeoutMs?: number;
}

function parseDate(value: unknown): Date | null {
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function parseDowntime(value: unknown): Downtime | null {
  if (value === null) return null;

  if (typeof value === "object" && !Array.isArray(value)) {
    const { components, start, end } = value as Record<string, unknown>;
    const startDate = parseDate(start);
    const endDate = parseDate(end);

    if (Array.isArray(components) && components.every((c) => typeof c === "string") && startDate && endDate) {
      return { components, start: startDate, end: endDate };
    }
  }

  throw new TypeError("malformed downtime document");
}

/**
 * createDowntimeReader returns a function resolving to the planned downtime, or null without one.
 * Reads are reused for `ttlMs`, and concurrent callers share one request.
 *
 * A failed or malformed read keeps the last known value: a network blip neither invents a downtime
 * nor drops one in progress. Before any read succeeds, it resolves to null.
 */
export function createDowntimeReader({
  url,
  fetch = globalThis.fetch,
  ttlMs = 60_000,
  timeoutMs = 5_000,
}: DowntimeReaderOptions): () => Promise<Downtime | null> {
  let downtime: Downtime | null = null;
  let expires = 0;
  let pending: Promise<Downtime | null> | undefined;

  async function refresh(): Promise<Downtime | null> {
    try {
      const response = await fetch(new URL(url), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) downtime = parseDowntime(await response.json());
    } catch {
      // Keep the last known value.
    } finally {
      expires = Date.now() + ttlMs;
      pending = undefined;
    }

    return downtime;
  }

  return () => (Date.now() < expires ? Promise.resolve(downtime) : (pending ??= refresh()));
}

/**
 * isDowntimeStarted reports whether a downtime is in effect at `now`. Only clearing a downtime ends
 * it, so its end plays no part.
 */
export function isDowntimeStarted(downtime: Downtime | null, now = new Date()): downtime is Downtime {
  return downtime !== null && now >= downtime.start;
}
