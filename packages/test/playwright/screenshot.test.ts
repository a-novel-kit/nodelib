// @vitest-environment node
import { screenshot } from "./screenshot";

import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Page, TestInfo } from "playwright/test";

const { toHaveScreenshot } = vi.hoisted(() => ({ toHaveScreenshot: vi.fn() }));
vi.mock("playwright/test", () => ({ expect: { soft: () => ({ toHaveScreenshot }) } }));

function checkpoint() {
  const page = { evaluate: vi.fn(), screenshot: vi.fn(async () => Buffer.from("png")) };
  const info = {
    attach: vi.fn(),
    annotations: [] as { type: string; description?: string }[],
    snapshotPath: (name: string) => resolve(".visual/snapshots/desktop/journey.spec.ts", name),
  };
  return { page, info, run: () => screenshot(page as unknown as Page, info as unknown as TestInfo, "login") };
}

describe("screenshot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    toHaveScreenshot.mockClear();
  });

  it("attaches the screenshot for local diagnosis without a reference directory", async () => {
    const { page, info, run } = checkpoint();

    await run();

    expect(info.attach).toHaveBeenCalledWith("login", { body: Buffer.from("png"), contentType: "image/png" });
    expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true, mask: [], animations: "disabled" });
    expect(info.annotations).toEqual([]);
    expect(toHaveScreenshot).not.toHaveBeenCalled();
  });

  it("compares against the reference and names the snapshot for the test-playwright action", async () => {
    vi.stubEnv("PLAYWRIGHT_SNAPSHOT_DIR", ".visual/snapshots");
    const { info, run } = checkpoint();

    await run();

    expect(info.annotations).toEqual([{ type: "visual-snapshot", description: "desktop/journey.spec.ts/login.png" }]);
    expect(toHaveScreenshot).toHaveBeenCalledWith("login.png", { fullPage: true, mask: [], animations: "disabled" });
    expect(info.attach).not.toHaveBeenCalled();
  });
});
