import { saveTelemetryChoice } from "./consent";
import { BrowserTelemetry } from "./telemetry";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as Sentry from "@sentry/browser";

const DSN = "https://key@o1.ingest.sentry.io/1";

const sent = vi.hoisted(() => [] as string[]);

// The SDK wraps `fetch` once per page, at its first start, so the stub stays for the whole file.
const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}"));
vi.stubGlobal("fetch", fetch);

// The real SDK runs, but its envelopes land in `sent` instead of reaching Sentry.
vi.mock("@sentry/browser", async (importOriginal) => {
  const sentry = await importOriginal<typeof Sentry>();
  const transport: Sentry.BrowserOptions["transport"] = (options) =>
    sentry.createTransport(options, async ({ body }) => {
      sent.push(typeof body === "string" ? body : new TextDecoder().decode(body));
      return { statusCode: 200 };
    });

  return { ...sentry, init: vi.fn((options: Sentry.BrowserOptions) => sentry.init({ ...options, transport })) };
});

/** Returns the payloads of every envelope item of the given type sent so far. */
function sentItems(type: string): Record<string, unknown>[] {
  return sent.flatMap((envelope) => {
    const lines = envelope.split("\n").filter(Boolean);
    return lines.flatMap((line, index) =>
      JSON.parse(lines[index - 1] ?? "{}").type === type ? [JSON.parse(line)] : []
    );
  });
}

function activeRouteName(): string | undefined {
  const span = Sentry.getActiveSpan();
  return span && Sentry.spanToJSON(Sentry.getRootSpan(span)).name;
}

afterEach(async () => {
  // A closed client leaves its last span active on the shared scope.
  Sentry.getActiveSpan()?.end();
  await Sentry.close();
  localStorage.clear();
  sent.length = 0;
  vi.clearAllMocks();
});

describe("BrowserTelemetry", () => {
  it("loads nothing until the visitor accepts", async () => {
    const telemetry = new BrowserTelemetry({ dsn: DSN });

    await telemetry.start();

    expect(telemetry.choice).toBeUndefined();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("stays off without a DSN, whatever the visitor chose", async () => {
    saveTelemetryChoice("accepted");
    const telemetry = new BrowserTelemetry({});

    await telemetry.start();

    expect(telemetry.enabled).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("starts for a visitor who accepted on an earlier visit", async () => {
    saveTelemetryChoice("accepted");

    await new BrowserTelemetry({ dsn: DSN, release: "platform-studio@1.2.3" }).start();

    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: DSN, release: "platform-studio@1.2.3" }));
    expect(Sentry.getClient()?.getIntegrationByName("BrowserTracing")).toBeDefined();
    expect(Sentry.getClient()?.getIntegrationByName("BrowserSession")).toBeUndefined();
    expect(Sentry.getClient()?.getIntegrationByName("Console")).toBeUndefined();
  });

  it("reports caught errors without query values", async () => {
    window.history.replaceState(null, "", "/password/reset?shortCode=secret");
    const telemetry = new BrowserTelemetry({ dsn: DSN });
    await telemetry.choose("accepted");

    telemetry.captureError(new Error("boom"));
    await Sentry.flush();

    const [event] = sentItems("event");
    expect(event).toMatchObject({ exception: { values: [{ value: "boom" }] } });
    expect(sent.join()).not.toContain("secret");
  });

  it("carries the trace to same-origin requests only", async () => {
    await new BrowserTelemetry({ dsn: DSN }).choose("accepted");

    await window.fetch("/api/stories");
    await window.fetch("https://example.com/feed");

    const headers = fetch.mock.calls.map(([, init]) => new Headers(init?.headers));
    expect(headers[0]?.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(headers[1]?.get("traceparent")).toBeNull();
  });

  it("stops reporting once the visitor declines", async () => {
    const telemetry = new BrowserTelemetry({ dsn: DSN });
    await telemetry.choose("accepted");

    await telemetry.choose("declined");
    telemetry.captureError(new Error("boom"));
    await Sentry.flush();

    expect(telemetry.choice).toBe("declined");
    expect(sentItems("event")).toHaveLength(0);
  });

  it("names navigations and page loads after their route", async () => {
    const telemetry = new BrowserTelemetry({ dsn: DSN });
    await telemetry.choose("accepted");

    telemetry.arrive("/(app)");
    expect(activeRouteName()).toBe("/(app)");

    telemetry.navigate({ to: { route: { id: "/(app)/stories/[id]" } } });
    expect(activeRouteName()).toBe("/(app)/stories/[id]");
  });

  it("names the page load after the route the visitor reached before accepting", async () => {
    const telemetry = new BrowserTelemetry({ dsn: DSN });

    telemetry.arrive("/(app)/account");
    await telemetry.choose("accepted");

    expect(activeRouteName()).toBe("/(app)/account");
  });

  it("opens no span for a navigation that leaves the platform", async () => {
    const telemetry = new BrowserTelemetry({ dsn: DSN });
    await telemetry.choose("accepted");
    telemetry.arrive("/(app)");

    telemetry.navigate({ to: null, willUnload: true });

    expect(activeRouteName()).toBe("/(app)");
  });
});
