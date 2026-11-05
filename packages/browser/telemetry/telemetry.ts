import { type TelemetryChoice, readTelemetryChoice, saveTelemetryChoice } from "./consent.js";

import type { Faro, TransportItem } from "@grafana/faro-web-sdk";

/** BrowserTelemetryOptions configures a platform's browser telemetry. */
export interface BrowserTelemetryOptions {
  /** Names the Faro collector of the platform's Frontend Observability app. Without it, nothing reports and the visitor is never asked. */
  url?: string;
  /** Names the platform, as its repository does: `platform-studio`. */
  name: string;
  /** Names the release the browser runs. */
  version: string;
  /**
   * Names the domain every app that shares the visitor's choice runs under, as `storyverse.fr`, so
   * one answer covers them all. Without it, the choice stays with the current host.
   */
  consentDomain?: string;
}

// An absolute URL's query and fragment. Short-code links carry credentials there.
const URL_TAIL = /(https?:\/\/[^\s?#"'<>]*)[?#][^\s"'<>]*/g;

/**
 * Removes every URL's query and fragment from an item before it leaves the browser: the page, fetch
 * spans and resource timings all name full URLs. The item is plain data, so its tree is walked in
 * place with an explicit stack.
 */
function withoutQueries(item: TransportItem): TransportItem {
  const stack: object[] = [item];
  for (let node = stack.pop(); node; node = stack.pop()) {
    const fields = node as Record<string, unknown>;
    for (const key of Object.keys(fields)) {
      const value = fields[key];
      if (typeof value === "string") fields[key] = value.replace(URL_TAIL, "$1");
      else if (typeof value === "object" && value !== null) stack.push(value);
    }
  }
  return item;
}

/**
 * BrowserTelemetry reports the visitor's errors, page views, Web Vitals and requests to Grafana Faro
 * once they accept. Their requests to the platform carry a W3C `traceparent`, so each trace continues
 * through the platform's server into the services.
 *
 * Faro's SDK downloads only after the visitor accepts, so a visitor who declines loads none of it.
 * A session lasts one visit and is never kept on the device.
 */
export class BrowserTelemetry {
  readonly #options: BrowserTelemetryOptions;
  #loading: Promise<void> | undefined;
  #faro: Faro | undefined;
  #route: string | undefined;

  constructor(options: BrowserTelemetryOptions) {
    this.#options = options;
  }

  /** Reports whether the platform collects browser telemetry at all. When false, it asks nothing. */
  get enabled(): boolean {
    return Boolean(this.#options.url);
  }

  /** Returns the visitor's choice in this browser, or undefined while they must choose. */
  get choice(): TelemetryChoice | undefined {
    return readTelemetryChoice();
  }

  /** Starts reporting when the visitor accepted on an earlier visit. Call it from the client `init` hook. */
  start(): Promise<void> {
    return this.enabled && this.choice === "accepted" ? this.#load() : Promise.resolve();
  }

  /** Records the visitor's choice, then starts or stops reporting to match it. */
  async choose(choice: TelemetryChoice): Promise<void> {
    saveTelemetryChoice(choice, { domain: this.#options.consentDomain });
    if (choice === "accepted") {
      await this.#load();
      this.#faro?.unpause();
      return;
    }

    // Faro cannot unload, so it stops sending instead.
    await this.#loading;
    this.#faro?.pause();
  }

  /** Reports an error SvelteKit caught. Call it from the client `handleError` hook. */
  captureError(error: unknown): void {
    this.#faro?.api.pushError(error instanceof Error ? error : new Error(String(error)));
  }

  /**
   * Names the current view after the route the visitor reached, on the page load and on each
   * navigation. Call it from `afterNavigate` with `page.route.id`.
   */
  arrive(routeId: string | null): void {
    this.#route = routeId ?? undefined;
    if (this.#route) this.#faro?.api.setView({ name: this.#route });
  }

  #load(): Promise<void> {
    if (!this.enabled) return Promise.resolve();

    this.#loading ??= Promise.all([import("@grafana/faro-web-sdk"), import("@grafana/faro-web-tracing")]).then(
      ([sdk, tracing]) => {
        this.#faro = sdk.initializeFaro({
          url: this.#options.url,
          app: { name: this.#options.name, version: this.#options.version },
          // The visitor may accept after the page reached its route, so the first view takes it here.
          view: this.#route ? { name: this.#route } : undefined,
          sessionTracking: { persistent: false },
          instrumentations: [
            // Console messages may quote story text, so none is collected.
            ...sdk.getWebInstrumentations({ captureConsole: false }),
            // Same-origin requests, the default targets, reach the platform's server.
            new tracing.TracingInstrumentation(),
          ],
          beforeSend: withoutQueries,
        });
      },
      // Telemetry never breaks the page. A later choice tries again.
      () => {
        this.#loading = undefined;
      }
    );

    return this.#loading;
  }
}
