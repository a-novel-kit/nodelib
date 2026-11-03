// @vitest-environment node
import { screenshot } from "./screenshot";

import { resolve } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { type Browser, chromium, devices } from "playwright";
import type { Page, TestInfo } from "playwright/test";

const { toHaveScreenshot } = vi.hoisted(() => ({ toHaveScreenshot: vi.fn() }));
vi.mock("playwright/test", () => ({ expect: { soft: () => ({ toHaveScreenshot }) } }));

function checkpoint() {
  const page = {
    evaluate: vi.fn(),
    viewportSize: () => ({ width: 1280, height: 720 }),
    setViewportSize: vi.fn(),
    screenshot: vi.fn(async () => Buffer.from("png")),
  };
  const info = {
    attach: vi.fn(),
    annotations: [] as { type: string; description?: string }[],
    snapshotPath: (name: string) => resolve(".visual/snapshots/desktop/journey.spec.ts", name),
  };
  return { page, info, run: () => screenshot(page as unknown as Page, info as unknown as TestInfo, "login") };
}

// A control taller under a coarse pointer, the value it pushes down, and the document's last row.
const TOUCH_PAGE = `<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0 }
  #control { height: 100px; background: red }
  @media (pointer: coarse) { #control { height: 140px; background: lime } }
  #value { height: 40px; background: blue }
  #spacer { height: 2000px }
  #end { height: 40px; background: yellow }
</style>
<div id="control"></div><div id="value"></div><div id="spacer"></div><div id="end"></div>`;

/** Reads a capture's colors in its left column, at the given rows in CSS pixels. */
async function colorsAt(page: Page, png: Buffer, rows: number[]): Promise<string[]> {
  return page.evaluate(
    async ({ source, rows, scale }) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const context = new OffscreenCanvas(image.width, image.height).getContext("2d")!;
      context.drawImage(image, 0, 0);
      return rows.map((row) =>
        context
          .getImageData(10, Math.round(row * scale), 1, 1)
          .data.slice(0, 3)
          .join(",")
      );
    },
    { source: `data:image/png;base64,${png.toString("base64")}`, rows, scale: devices["Pixel 7"].deviceScaleFactor }
  );
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
    expect(page.setViewportSize).not.toHaveBeenCalled();
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

describe("screenshot in Chromium", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(() => browser.close());

  it("paints a touch page's whole document as a phone renders it, under masks placed on it", async () => {
    const context = await browser.newContext({ ...devices["Pixel 7"] });
    const page = await context.newPage();
    await page.setContent(TOUCH_PAGE);
    const info = { attach: vi.fn() };

    await screenshot(page, info as unknown as TestInfo, "touch", [page.locator("#value")]);

    const [[, { body }]] = info.attach.mock.calls;
    // The control is lime through row 140, the masked value magenta through row 180, the last row yellow.
    expect(await colorsAt(page, body, [50, 120, 160, 2200])).toEqual(["0,255,0", "0,255,0", "255,0,255", "255,255,0"]);
    expect(page.viewportSize()).toEqual(devices["Pixel 7"].viewport);
    await context.close();
  });
});
