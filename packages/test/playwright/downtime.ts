import { createServer } from "node:http";

/** The planned downtime states a platform's journeys run against, one platform server each. */
export type DowntimeState = "none" | "scheduled" | "started";

// The first port is the suite's base URL, the one SvelteKitPlaywright serves by default.
const ports: Record<DowntimeState, number> = { none: 4173, scheduled: 4174, started: 4175 };

const documentPort = 4180;

/** DowntimeServer is one platform server under test, which reads the downtime of one state. */
export interface DowntimeServer {
  port: number;
  serverEnvironment: { DOWNTIME_URL: string };
}

/**
 * Lists the platform servers under test for `SvelteKitPlaywright`'s `servers`, one per state. The
 * first reads no downtime. The downtime reader keeps a value for a minute, so a server cannot switch
 * states during a run.
 */
export function downtimeServers(): DowntimeServer[] {
  return Object.entries(ports).map(([state, port]) => ({
    port,
    serverEnvironment: { DOWNTIME_URL: `http://127.0.0.1:${documentPort}/${state}.json` },
  }));
}

/** Returns the origin of the platform server that reads a state's downtime, for a journey's `baseURL`. */
export function downtimeOrigin(state: DowntimeState): string {
  return `http://127.0.0.1:${ports[state]}`;
}

/**
 * Builds a Playwright global setup that publishes each state's downtime document, as the infra
 * repository serves the real one: none, one far ahead, and one under way. `components` names what
 * the downtime stops, and must include a component the platform's downtime filter keeps.
 */
export function downtimeSetup(components: string[] = ["service-authentication.database"]) {
  const documents: Record<DowntimeState, unknown> = {
    none: null,
    scheduled: { components, start: "2099-01-12T06:00:00Z", end: "2099-01-12T08:30:00Z" },
    started: { components, start: "2026-01-12T06:00:00Z", end: "2099-01-12T08:30:00Z" },
  };

  return async function setup(): Promise<() => Promise<void>> {
    const server = createServer((request, response) => {
      const state = request.url?.slice(1).replace(/\.json$/, "") as DowntimeState;
      const published = Object.hasOwn(documents, state);
      response.writeHead(published ? 200 : 404, { "content-type": "application/json" });
      response.end(JSON.stringify(published ? documents[state] : null));
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(documentPort, "127.0.0.1", resolve);
    });

    return () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  };
}
