// @vitest-environment node
import { downtimeOrigin, downtimeServers, downtimeSetup } from "./downtime";

import { describe, expect, it } from "vitest";

describe("downtimeServers", () => {
  it("gives each state its own server, the one without a downtime first", () => {
    expect(downtimeServers()).toEqual([
      { port: 4173, serverEnvironment: { DOWNTIME_URL: "http://127.0.0.1:4180/none.json" } },
      { port: 4174, serverEnvironment: { DOWNTIME_URL: "http://127.0.0.1:4180/scheduled.json" } },
      { port: 4175, serverEnvironment: { DOWNTIME_URL: "http://127.0.0.1:4180/started.json" } },
    ]);
    expect(downtimeOrigin("started")).toBe("http://127.0.0.1:4175");
  });
});

describe("downtimeSetup", () => {
  it("publishes each state's downtime until its teardown", async () => {
    const teardown = await downtimeSetup(["service-studio.database"])();

    try {
      const read = (state: string) => fetch(`http://127.0.0.1:4180/${state}.json`);

      await expect((await read("none")).json()).resolves.toBeNull();
      await expect((await read("scheduled")).json()).resolves.toEqual({
        components: ["service-studio.database"],
        start: "2099-01-12T06:00:00Z",
        end: "2099-01-12T08:30:00Z",
      });
      await expect((await read("started")).json()).resolves.toMatchObject({ start: "2026-01-12T06:00:00Z" });

      const unknown = await read("toString");
      expect(unknown.status).toBe(404);
      await unknown.body?.cancel();
    } finally {
      await teardown();
    }

    await expect(fetch("http://127.0.0.1:4180/none.json")).rejects.toThrow();
  });
});
