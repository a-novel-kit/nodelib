import { FaroSourceMaps } from "./faro";

import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Plugin } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OPTIONS = { appName: "platform-studio", endpoint: "https://faro.test/faro", stackId: 42 };
const ENV = { FARO_SOURCEMAP_API_KEY: "key", FARO_SOURCEMAP_APP_ID: "7" };

type WriteBundle = (options: { dir?: string }, bundle: Record<string, unknown>) => Promise<void>;

function plugin(env: Record<string, string | undefined> = ENV): Plugin {
  const created = FaroSourceMaps(OPTIONS, env);
  if (!created) throw new TypeError("Expected the plugin");
  return created;
}

function clientConfig(created: Plugin) {
  const hook = created.configEnvironment as (name: string) => { build: Record<string, unknown> } | undefined;
  return { client: hook("client"), ssr: hook("ssr") };
}

let dir: string;
const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response("{}"));

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "faro-source-maps-"));
  await writeFile(path.join(dir, "entry.js"), "code");
  await writeFile(path.join(dir, "entry.js.map"), '{"version":3}');
  vi.stubGlobal("fetch", fetch);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  fetch.mockReset();
  fetch.mockImplementation(async () => new Response("{}"));
});

describe("FaroSourceMaps", () => {
  it("does nothing without the upload key", () => {
    expect(FaroSourceMaps(OPTIONS, {})).toBeNull();
  });

  it("refuses a key without an app to send the maps to", () => {
    expect(() => FaroSourceMaps(OPTIONS, { FARO_SOURCEMAP_API_KEY: "key" })).toThrow("FARO_SOURCEMAP_APP_ID");
  });

  it("makes hidden maps for the client alone, with the bundle ID the SDK reads", () => {
    const created = plugin();
    const { client, ssr } = clientConfig(created);

    expect(client?.build).toMatchObject({ sourcemap: "hidden" });
    expect(JSON.stringify(client?.build)).toMatch(
      /globalThis\[\\"__faroBundleId_platform-studio\\"\]=\\"[0-9a-f-]{36}\\";/
    );
    expect(ssr).toBeUndefined();
    const applies = created.applyToEnvironment as (environment: { name: string }) => boolean;
    expect([applies({ name: "client" }), applies({ name: "ssr" })]).toEqual([true, false]);
  });

  it("uploads each map to the app's bundle, then deletes it", async () => {
    await (plugin().writeBundle as unknown as WriteBundle)({ dir }, { "entry.js": {}, "entry.js.map": {} });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.lastCall ?? [];
    expect(String(url)).toMatch(/^https:\/\/faro\.test\/faro\/api\/v1\/app\/7\/sourcemaps\/[0-9a-f-]{36}$/);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer 42:key");
    expect(String(init?.body)).toBe('{"version":3}');
    expect(await readdir(dir)).toEqual(["entry.js"]);
  });

  it("fails the build when Faro refuses a map", async () => {
    const response = new Response("denied", { status: 401 });
    fetch.mockResolvedValueOnce(response);

    await expect((plugin().writeBundle as unknown as WriteBundle)({ dir }, { "entry.js.map": {} })).rejects.toThrow(
      "Faro refused entry.js.map with status 401."
    );
    expect(response.bodyUsed).toBe(true);
  });
});
