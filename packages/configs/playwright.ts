import { resolve } from "node:path";

import { type PlaywrightTestConfig, devices } from "playwright/test";

/** Product details for a SvelteKit platform's end-to-end suite. */
export interface SvelteKitPlaywrightOptions {
  /** Port the built application listens on. */
  port: number;
  /** Server environment beyond HOST, PORT and ORIGIN, such as backend service URLs. */
  serverEnvironment?: Record<string, string>;
  /** Module that starts the disposable services and returns their teardown. */
  globalSetup?: string;
  /** Stylesheet applied to every screenshot, typically to hide volatile content. */
  screenshotStyle?: string;
  /** Browser options merged over the deterministic defaults. */
  use?: PlaywrightTestConfig["use"];
}

/**
 * Builds the Playwright configuration shared by SvelteKit platforms. It owns the configuration side
 * of the contract with the `test-playwright` action: screenshots resolve under
 * `PLAYWRIGHT_SNAPSHOT_DIR` as `{projectName}/{testFilePath}/{arg}{ext}`, and the HTML report lands in
 * `playwright-report/`. The suite runs the production build, served by its Node adapter.
 */
export function SvelteKitPlaywright(options: SvelteKitPlaywrightOptions): PlaywrightTestConfig {
  const baseURL = `http://127.0.0.1:${options.port}`;
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
    webServer: {
      command: "pnpm build && node build",
      url: `${baseURL}/ping`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { ...options.serverEnvironment, HOST: "127.0.0.1", PORT: String(options.port), ORIGIN: baseURL },
    },
  };
}
