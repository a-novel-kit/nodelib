import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import { expect } from "playwright/test";

const run = promisify(execFile);

/** Runs one `compose` subcommand against the suite's services. */
export type Compose = (...args: string[]) => Promise<{ stdout: string; stderr: string }>;

/**
 * Binds `compose` to one file. The engine comes from `E2E_CONTAINER_ENGINE` and defaults to
 * `docker`, so a Podman host sets it to `podman`.
 */
export function createCompose(file = "builds/compose.e2e.yaml"): Compose {
  return (...args) =>
    run(process.env.E2E_CONTAINER_ENGINE ?? "docker", ["compose", "--file", file, ...args], { timeout: 120_000 });
}

/** Services a global setup starts and the check that tells when they accept requests. */
export interface ComposeSetupOptions {
  compose: Compose;
  /** Resolves `true` once the services are ready; a rejection counts as not ready yet. */
  ready: () => Promise<boolean>;
  /** Readiness deadline in milliseconds. */
  timeout?: number;
}

/**
 * Builds a Playwright global setup that owns fresh services for one run. Its teardown writes
 * `integration-services.log`, which the `test-playwright` action uploads, then removes the
 * services and their volumes, including when the services never became ready.
 */
export function composeSetup({ compose, ready, timeout = 60_000 }: ComposeSetupOptions) {
  return async function setup(): Promise<() => Promise<void>> {
    process.env.COMPOSE_PROJECT_NAME ??= `e2e-${process.pid}`;

    const cleanup = async () => {
      try {
        const { stdout } = await compose("logs", "--no-color");
        await writeFile("integration-services.log", stdout);
      } finally {
        await compose("down", "--volumes", "--remove-orphans");
      }
    };

    try {
      await compose("up", "--detach");
      await expect
        .poll(() => ready().catch(() => false), { timeout, message: "Integration services are ready" })
        .toBe(true);
    } catch (error) {
      await cleanup();
      throw error;
    }

    return cleanup;
  };
}
