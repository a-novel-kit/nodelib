import { resolve } from "node:path";

import { type PlaywrightTestConfig, devices } from "playwright/test";

/** One server of the application's production build. */
export interface SvelteKitPlaywrightServer {
  /** Port the server listens on. */
  port: number;
  /** Environment of this server alone, over the shared `serverEnvironment`. */
  serverEnvironment?: Record<string, string>;
}

/** Product details for a SvelteKit platform's end-to-end suite. */
export interface SvelteKitPlaywrightOptions {
  /**
   * Servers of one build, each on its own port, such as one per planned downtime state. The first
   * builds the application and serves `baseURL`; a test reaches another through its origin.
   * @default [{ port: 4173 }]
   */
  servers?: SvelteKitPlaywrightServer[];
  /** @deprecated Pass `servers: [{ port }]`. */
  port?: number;
  /** Environment of every server beyond HOST, PORT and ORIGIN, such as backend service URLs. */
  serverEnvironment?: Record<string, string>;
  /** Module that starts the disposable services and returns their teardown. */
  globalSetup?: string;
  /** Stylesheet applied to every screenshot, typically to hide volatile content. */
  screenshotStyle?: string;
  /** Browser options merged over the deterministic defaults. */
  use?: PlaywrightTestConfig["use"];
}

/**
 * Builds the Playwright configuration shared by SvelteKit platforms. The suite runs the production
 * build, served by its Node adapter.
 *
 * The configuration holds its side of the contract with the `test-playwright` action. Screenshots
 * resolve under `PLAYWRIGHT_SNAPSHOT_DIR` as `{projectName}/{testFilePath}/{arg}{ext}`, and the HTML
 * report lands in `playwright-report/`.
 */
export function SvelteKitPlaywright(options: SvelteKitPlaywrightOptions = {}): PlaywrightTestConfig {
  const servers = options.servers ?? [{ port: options.port ?? 4173 }];
  // The first server builds the application and serves the suite's base URL.
  const baseURL = origin(servers[0]?.port ?? 4173);
  const snapshots = process.env.PLAYWRIGHT_SNAPSHOT_DIR;

  return {
    testDir: "./tests/e2e",
    snapshotPathTemplate: snapshots ? `${resolve(snapshots)}/{projectName}/{testFilePath}/{arg}{ext}` : undefined,
    globalSetup: options.globalSetup,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    timeout: 45_000,
    expect: {
      timeout: 10_000,
      toHaveScreenshot: { stylePath: options.screenshotStyle },
    },
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
      baseURL,
      locale: "en-US",
      timezoneId: "UTC",
      reducedMotion: "reduce",
      colorScheme: "dark",
      actionTimeout: 10_000,
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
      ...options.use,
    },
    projects: [
      { name: "desktop", use: { ...devices["Desktop Chrome"] } },
      { name: "mobile", use: { ...devices["Pixel 7"] } },
    ],
    // Playwright starts the servers in order, so the later ones serve the build the first one made.
    webServer: servers.map(({ port, serverEnvironment }, index) => ({
      command: index === 0 ? "pnpm build && node build" : "node build",
      url: `${origin(port)}/ping`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...options.serverEnvironment,
        ...serverEnvironment,
        HOST: "127.0.0.1",
        PORT: String(port),
        ORIGIN: origin(port),
      },
    })),
  };
}

function origin(port: number): string {
  return `http://127.0.0.1:${port}`;
}
