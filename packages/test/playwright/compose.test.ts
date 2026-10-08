// @vitest-environment node
import { type Compose, composeSetup, createCompose } from "./compose";

import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const directories: string[] = [];

function directory(): string {
  const path = mkdtempSync(join(tmpdir(), "nodelib-compose-"));
  directories.push(path);
  return path;
}

/** Runs `run` from a scratch directory, where the setup writes its service log. */
async function inDirectory<T>(path: string, run: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(path);
  try {
    return await run();
  } finally {
    process.chdir(previous);
  }
}

function fakeCompose() {
  return vi.fn<Compose>(async (...args) => ({ stdout: args[0] === "logs" ? "service logs\n" : "", stderr: "" }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const path of directories.splice(0)) rmSync(path, { force: true, recursive: true });
});

describe("createCompose", () => {
  it("runs compose against its file with the engine E2E_CONTAINER_ENGINE names", async () => {
    const path = directory();
    const engine = join(path, "engine");
    writeFileSync(
      engine,
      `#!/usr/bin/env node\nrequire("node:fs").writeFileSync(${JSON.stringify(join(path, "calls"))}, JSON.stringify(process.argv.slice(2)));\n`
    );
    chmodSync(engine, 0o755);
    vi.stubEnv("E2E_CONTAINER_ENGINE", engine);

    await createCompose("builds/e2e.yaml")("up", "--detach");

    expect(JSON.parse(readFileSync(join(path, "calls"), "utf8"))).toEqual([
      "compose",
      "--file",
      "builds/e2e.yaml",
      "up",
      "--detach",
    ]);
  });
});

describe("composeSetup", () => {
  it("starts the services, waits through a failing readiness check, and tears them down with their logs", async () => {
    const path = directory();
    const compose = fakeCompose();
    const ready = vi.fn<() => Promise<boolean>>().mockRejectedValueOnce(new Error("refused")).mockResolvedValue(true);

    const teardown = await inDirectory(path, () => composeSetup({ compose, ready })());
    expect(compose.mock.calls).toEqual([["up", "--detach"]]);

    await inDirectory(path, teardown);
    expect(compose.mock.calls.slice(1)).toEqual([
      ["logs", "--no-color"],
      ["down", "--volumes", "--remove-orphans"],
    ]);
    expect(readFileSync(join(path, "integration-services.log"), "utf8")).toBe("service logs\n");
  });

  it("removes the services and keeps their logs when they never become ready", async () => {
    const path = directory();
    const compose = fakeCompose();

    await expect(
      inDirectory(path, () => composeSetup({ compose, ready: async () => false, timeout: 300 })())
    ).rejects.toThrow("Integration services are ready");

    expect(compose.mock.calls).toEqual([
      ["up", "--detach"],
      ["logs", "--no-color"],
      ["down", "--volumes", "--remove-orphans"],
    ]);
    expect(readFileSync(join(path, "integration-services.log"), "utf8")).toBe("service logs\n");
  });
});
