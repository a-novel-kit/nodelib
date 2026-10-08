import { relative, resolve } from "node:path";

import { type Locator, type Page, type TestInfo, expect } from "playwright/test";

/**
 * Captures a named visual checkpoint. With `PLAYWRIGHT_SNAPSHOT_DIR` set, as the `test-playwright`
 * action does, it compares against the reference and records a `visual-snapshot` annotation with the
 * snapshot's relative path, from which the action detects removed checkpoints. Without it, the
 * screenshot is attached for local diagnosis. Keep `name` fixed: a name that changes with the page's
 * copy reads as a removed checkpoint instead of a reviewable diff.
 */
export async function screenshot(page: Page, info: TestInfo, name: string, mask: Locator[] = []): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const options = { fullPage: true, mask, animations: "disabled" as const };
  const root = process.env.PLAYWRIGHT_SNAPSHOT_DIR;
  if (!root) {
    await info.attach(name, { body: await page.screenshot(options), contentType: "image/png" });
    return;
  }

  const filename = `${name}.png`;
  info.annotations.push({
    type: "visual-snapshot",
    description: relative(resolve(root), info.snapshotPath(filename, { kind: "screenshot" }))
      .split("\\")
      .join("/"),
  });
  await expect.soft(page).toHaveScreenshot(filename, options);
}
