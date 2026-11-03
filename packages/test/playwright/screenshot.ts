import { relative, resolve } from "node:path";

import { type Locator, type Page, type TestInfo, expect } from "playwright/test";

/**
 * Captures a named visual checkpoint. Keep `name` fixed. A name that changes with the page's copy
 * reads as a removed checkpoint instead of a reviewable diff.
 *
 * The `test-playwright` action sets `PLAYWRIGHT_SNAPSHOT_DIR`. The checkpoint then compares against
 * its reference and records a `visual-snapshot` annotation with the snapshot's relative path. The
 * action reads these annotations to detect removed checkpoints. Without the variable, the screenshot
 * is attached for local diagnosis.
 */
export async function screenshot(page: Page, info: TestInfo, name: string, mask: Locator[] = []): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const options = { fullPage: true, mask, animations: "disabled" as const };
  const root = process.env.PLAYWRIGHT_SNAPSHOT_DIR;
  if (!root) {
    const body = await fitViewportToDocument(page, () => page.screenshot(options));
    await info.attach(name, { body, contentType: "image/png" });
    return;
  }

  const filename = `${name}.png`;
  info.annotations.push({
    type: "visual-snapshot",
    description: relative(resolve(root), info.snapshotPath(filename, { kind: "screenshot" })).replaceAll("\\", "/"),
  });
  await fitViewportToDocument(page, () => expect.soft(page).toHaveScreenshot(filename, options));
}

/**
 * Runs a full-page capture of a coarse-pointer page at a viewport as tall as its document, where
 * viewport units measure the whole document. Chromium paints a capture beyond the viewport without
 * touch emulation, so the page would show its fine-pointer styles under masks placed from its coarse
 * layout. Tracked in https://issues.chromium.org/issues/558509412
 */
async function fitViewportToDocument<T>(page: Page, capture: () => Promise<T>): Promise<T> {
  const viewport = page.viewportSize();
  const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  if (!viewport || !coarse) return capture();

  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height });
  try {
    return await capture();
  } finally {
    await page.setViewportSize(viewport);
  }
}
