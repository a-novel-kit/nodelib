// @vitest-environment node
import { SvelteKitPlaywright } from "./playwright";

import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("SvelteKitPlaywright", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serves the production build with the product's environment and options", () => {
    const config = SvelteKitPlaywright({
      port: 4173,
      serverEnvironment: { AUTHENTICATION_SERVICE_URL: "http://127.0.0.1:14100" },
      globalSetup: "./tests/e2e/setup.ts",
      screenshotStyle: "./tests/e2e/screenshots.css",
      use: { colorScheme: "light" },
    });

    expect(config.webServer).toEqual({
      command: "pnpm build && node build",
      url: "http://127.0.0.1:4173/ping",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        AUTHENTICATION_SERVICE_URL: "http://127.0.0.1:14100",
        HOST: "127.0.0.1",
        PORT: "4173",
        ORIGIN: "http://127.0.0.1:4173",
      },
    });
    expect(config.use).toMatchObject({ baseURL: "http://127.0.0.1:4173", colorScheme: "light", timezoneId: "UTC" });
    expect(config.globalSetup).toBe("./tests/e2e/setup.ts");
    expect(config.expect?.toHaveScreenshot).toEqual({ stylePath: "./tests/e2e/screenshots.css" });
    expect(config.projects?.map((project) => project.name)).toEqual(["desktop", "mobile"]);
  });

  it("lays out snapshots for the test-playwright action only when it provides a directory", () => {
    expect(SvelteKitPlaywright({ port: 4173 }).snapshotPathTemplate).toBeUndefined();

    vi.stubEnv("PLAYWRIGHT_SNAPSHOT_DIR", ".visual/snapshots");

    expect(SvelteKitPlaywright({ port: 4173 }).snapshotPathTemplate).toBe(
      `${resolve(".visual/snapshots")}/{projectName}/{testFilePath}/{arg}{ext}`
    );
  });
});
