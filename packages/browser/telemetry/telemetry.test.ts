import { saveTelemetryChoice } from "./consent";
import { BrowserTelemetry } from "./telemetry";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as Faro from "@grafana/faro-web-sdk";

const COLLECTOR = "https://faro-collector-prod-eu-west-2.grafana.net/collect/key";
const OPTIONS = { url: COLLECTOR, name: "platform-studio", version: "1.2.3" };

// Every request reaches this stub, the collector's included. Faro wraps `fetch` at its first start,
// so the stub stays for the whole file.
const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}"));
vi.stubGlobal("fetch", fetch);

// The real SDK runs, one isolated instance per test, unbatched so each signal posts at once.
vi.mock("@grafana/faro-web-sdk", async (importOriginal) => {
  const faro = await importOriginal<typeof Faro>();
  const initializeFaro = (config: Faro.BrowserConfig) =>
    faro.initializeFaro({ ...config, isolate: true, batching: { enabled: false } });
  return { ...faro, initializeFaro: vi.fn(initializeFaro) };
});

interface Payload {
  meta?: { view?: { name?: string } };
  exceptions?: { value?: string }[];
}

/** Returns what Faro posted to its collector so far. */
function collected(): Payload[] {
  return fetch.mock.calls
    .filter(([input]) => String(input) === COLLECTOR)
    .map(([, init]) => JSON.parse(String(init?.body)) as Payload);
}

function exceptionValues(): (string | undefined)[] {
  return collected().flatMap((payload) => payload.exceptions?.map((exception) => exception.value) ?? []);
}

afterEach(() => {
  localStorage.clear();
  fetch.mockClear();
  vi.mocked(Faro.initializeFaro).mockClear();
});

describe("BrowserTelemetry", () => {
  it("loads nothing until the visitor accepts", async () => {
    const telemetry = new BrowserTelemetry(OPTIONS);

    await telemetry.start();

    expect(telemetry.choice).toBeUndefined();
    expect(Faro.initializeFaro).not.toHaveBeenCalled();
  });

  it("stays off without a collector, whatever the visitor chose", async () => {
    saveTelemetryChoice("accepted");
    const telemetry = new BrowserTelemetry({ name: "platform-studio", version: "1.2.3" });

    await telemetry.start();
    await telemetry.choose("accepted");

    expect(telemetry.enabled).toBe(false);
    expect(Faro.initializeFaro).not.toHaveBeenCalled();
  });

  it("starts for a visitor who accepted on an earlier visit, keeping no session or console", async () => {
    saveTelemetryChoice("accepted");

    await new BrowserTelemetry(OPTIONS).start();

    const [config] = vi.mocked(Faro.initializeFaro).mock.lastCall ?? [];
    expect(config).toMatchObject({
      url: COLLECTOR,
      app: { name: "platform-studio", version: "1.2.3" },
      sessionTracking: { persistent: false },
    });
    const instrumentations = config?.instrumentations?.map(({ name }) => name) ?? [];
    expect(instrumentations).toContain("@grafana/faro-web-tracing");
    expect(instrumentations.filter((name) => name.includes("console"))).toEqual([]);
  });

  it("reports caught errors without query values", async () => {
    window.history.replaceState(null, "", "/password/reset?shortCode=secret#target");
    const telemetry = new BrowserTelemetry(OPTIONS);
    await telemetry.choose("accepted");

    telemetry.captureError(new Error("boom"));

    await vi.waitFor(() => expect(exceptionValues()).toContain("boom"));
    const sent = JSON.stringify(collected());
    expect(sent).toContain("/password/reset");
    expect(sent).not.toContain("secret");
    expect(sent).not.toContain("target");
    window.history.replaceState(null, "", "/");
  });

  it("carries the trace to same-origin requests only", async () => {
    await new BrowserTelemetry(OPTIONS).choose("accepted");
    fetch.mockClear();

    await window.fetch("/api/stories");
    await window.fetch("https://example.com/feed");

    const headers = fetch.mock.calls.map(([, init]) => new Headers(init?.headers));
    expect(headers[0]?.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(headers[1]?.get("traceparent")).toBeNull();
  });

  it("sends nothing while the visitor declines, and resumes once they accept again", async () => {
    const telemetry = new BrowserTelemetry(OPTIONS);
    await telemetry.choose("accepted");

    await telemetry.choose("declined");
    telemetry.captureError(new Error("while declined"));
    await telemetry.choose("accepted");
    telemetry.captureError(new Error("accepted again"));

    await vi.waitFor(() => expect(exceptionValues()).toContain("accepted again"));
    expect(telemetry.choice).toBe("accepted");
    expect(exceptionValues()).not.toContain("while declined");
  });

  it("names views after the route the visitor reached", async () => {
    const telemetry = new BrowserTelemetry(OPTIONS);
    await telemetry.choose("accepted");

    telemetry.arrive("/(app)/stories/[id]");
    telemetry.captureError(new Error("boom"));

    await vi.waitFor(() => expect(exceptionValues()).toContain("boom"));
    expect(collected().at(-1)?.meta?.view?.name).toBe("/(app)/stories/[id]");
  });

  it("names the first view after the route reached before accepting", async () => {
    const telemetry = new BrowserTelemetry(OPTIONS);

    telemetry.arrive("/(app)/account");
    await telemetry.choose("accepted");
    telemetry.captureError(new Error("boom"));

    await vi.waitFor(() => expect(exceptionValues()).toContain("boom"));
    expect(collected().at(-1)?.meta?.view?.name).toBe("/(app)/account");
  });
});
