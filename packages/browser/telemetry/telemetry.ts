import { type TelemetryChoice, readTelemetryChoice, saveTelemetryChoice } from "./consent.js";

import type { BrowserOptions, Span } from "@sentry/browser";

type Sentry = typeof import("@sentry/browser");

/** BrowserTelemetryOptions configures a platform's browser telemetry. */
export interface BrowserTelemetryOptions {
  /** Names the Sentry project that receives the telemetry. Without it, nothing reports and the visitor is never asked. */
  dsn?: string;
  /** Names the release as `<repository>@<version>`, as the services name theirs. */
  release?: string;
}

/** TelemetryNavigation holds the parts of a SvelteKit navigation that telemetry reads. */
export interface TelemetryNavigation {
  to: { route: { id: string | null } } | null;
  willUnload?: boolean;
}

/**
 * BrowserTelemetry reports the visitor's errors, page loads, navigations and Web Vitals to Sentry
 * once they accept. Their requests to the platform carry a W3C `traceparent`, so each trace continues
 * through the platform's server into the services.
 *
 * Sentry's SDK downloads only after the visitor accepts, so a visitor who declines loads none of it.
 */
export class BrowserTelemetry {
  readonly #options: BrowserTelemetryOptions;
  #loading: Promise<void> | undefined;
  #sentry: Sentry | undefined;
  #route: string | undefined;
  // The page load's or the latest navigation's span, which the route reached names.
  #span: Span | undefined;

  constructor(options: BrowserTelemetryOptions) {
    this.#options = options;
  }

  /** Reports whether the platform collects browser telemetry at all. When false, it asks nothing. */
  get enabled(): boolean {
    return Boolean(this.#options.dsn);
  }

  /** Returns the visitor's choice on this device, or undefined while they must choose. */
  get choice(): TelemetryChoice | undefined {
    return readTelemetryChoice();
  }

  /** Starts reporting when the visitor accepted on an earlier visit. Call it from the client `init` hook. */
  start(): Promise<void> {
    return this.enabled && this.choice === "accepted" ? this.#load() : Promise.resolve();
  }

  /** Records the visitor's choice, then starts or stops reporting to match it. */
  async choose(choice: TelemetryChoice): Promise<void> {
    saveTelemetryChoice(choice);
    if (choice === "accepted") return this.#load();

    await this.#loading;
    await this.#sentry?.close();
    this.#sentry = undefined;
    this.#span = undefined;
    this.#loading = undefined;
  }

  /** Reports an error SvelteKit caught. Call it from the client `handleError` hook. */
  captureError(error: unknown): void {
    this.#sentry?.captureException(error);
  }

  /** Opens the span of a client-side navigation, named after its route. Call it from `beforeNavigate`. */
  navigate({ to, willUnload }: TelemetryNavigation): void {
    const client = this.#sentry?.getClient();
    const route = to?.route.id;
    if (!client || !route || willUnload) return;

    this.#span = this.#sentry?.startBrowserTracingNavigationSpan(client, { name: route });
  }

  /**
   * Names the current page load or navigation after the route it reached, which a redirect may have
   * changed. Call it from `afterNavigate` with `page.route.id`: SvelteKit's first navigation lacks it.
   */
  arrive(routeId: string | null): void {
    this.#route = routeId ?? undefined;
    if (this.#route) this.#span?.updateName(this.#route);
  }

  #load(): Promise<void> {
    this.#loading ??= import("@sentry/browser").then(
      (sentry) => {
        sentry.init(this.#sdkOptions(sentry));
        // Starting, the SDK opens the page load's span.
        this.#span = sentry.getActiveSpan();
        this.#sentry = sentry;
      },
      // Telemetry never breaks the page. A later choice tries again.
      () => {
        this.#loading = undefined;
      }
    );

    return this.#loading;
  }

  #sdkOptions(sentry: Sentry): BrowserOptions {
    return {
      dsn: this.#options.dsn,
      release: this.#options.release,
      tracesSampleRate: 1,
      // Same-origin requests, the SDK's default targets, reach the platform's server, which reads
      // the W3C header.
      propagateTraceparent: true,
      // Short-code links carry credentials in their query, so query values never leave the browser.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: { allow: [] },
      },
      integrations: (defaults) => [
        // Sessions count visits, and console messages may quote story text: neither is collected.
        ...defaults.filter(({ name }) => name !== "BrowserSession" && name !== "Console"),
        // SvelteKit updates the history only once a navigation has loaded, so navigate opens its spans.
        // The visitor may accept after the page reached its route, so the page load takes its name here.
        sentry.browserTracingIntegration({
          instrumentNavigation: false,
          beforeStartSpan: (options) =>
            options.op === "pageload" && this.#route ? { ...options, name: this.#route } : options,
        }),
      ],
    };
  }
}
