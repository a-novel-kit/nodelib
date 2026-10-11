// @vitest-environment node
import { startTelemetry } from "./telemetry";

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { context, propagation, trace } from "@opentelemetry/api";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-node";

const { exporters } = vi.hoisted(() => ({
  exporters: [] as { config: { url: string; headers: () => Promise<Record<string, string>> }; spans: ReadableSpan[] }[],
}));

vi.mock("@opentelemetry/exporter-trace-otlp-proto", () => ({
  OTLPTraceExporter: class implements SpanExporter {
    readonly spans: ReadableSpan[] = [];

    constructor(readonly config: (typeof exporters)[number]["config"]) {
      exporters.push(this);
    }

    export(spans: ReadableSpan[], done: (result: { code: number }) => void) {
      this.spans.push(...spans);
      done({ code: 0 });
    }

    async shutdown() {}
  },
}));

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getRequestHeaders() {
      return new Headers({ authorization: "Bearer application-default" });
    }
  },
}));

afterEach(() => {
  trace.disable();
  propagation.disable();
  context.disable();
  exporters.length = 0;
  vi.restoreAllMocks();
});

/** Runs fn with spans printed to standard output, and returns the spans it printed. */
async function printedSpans(fn: () => Promise<void>): Promise<{ name: string; attributes: Record<string, unknown> }[]> {
  const dir = vi.spyOn(console, "dir").mockImplementation(() => {});
  const telemetry = startTelemetry({ serviceName: "platform", enabled: true });

  await fn();
  await telemetry.shutdown();

  return dir.mock.calls.map(([span]) => span as { name: string; attributes: Record<string, unknown> });
}

describe("startTelemetry", () => {
  it("installs nothing when disabled", async () => {
    const telemetry = startTelemetry({ serviceName: "platform", enabled: false });

    const span = trace.getTracer("test").startSpan("operation");
    expect(span.isRecording()).toBe(false);
    span.end();

    await telemetry.shutdown();
  });

  it("redacts every query value from recorded URLs", async () => {
    const spans = await printedSpans(async () => {
      trace
        .getTracer("test")
        .startSpan("operation", {
          attributes: {
            "http.url": "https://studio.test/ext/account/create?shortCode=secret&target=c2VjcmV0#form",
            "url.full": "https://auth.test/v2/credentials?email=user%40example.com&limit=10",
            "url.query": "?email=user%40example.com",
          },
        })
        .end();
    });

    expect(spans).toHaveLength(1);
    expect(spans[0]?.attributes).toEqual({
      "http.url": "https://studio.test/ext/account/create?shortCode=REDACTED&target=REDACTED#form",
      "url.full": "https://auth.test/v2/credentials?email=REDACTED&limit=REDACTED",
      "url.query": "?email=REDACTED",
    });
  });

  it("sends the trace context with a fetch made inside a span", async () => {
    const received: (string | undefined)[] = [];
    const server = createServer((request, response) => {
      received.push(request.headers.traceparent as string | undefined);
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v2/ping`;

    let traceId = "";
    const spans = await printedSpans(async () => {
      await trace.getTracer("test").startActiveSpan("request", async (span) => {
        traceId = span.spanContext().traceId;
        await fetch(url);
        span.end();
      });
      // Outside any request, a fetch records no span.
      await fetch(url);
    });
    server.close();

    expect(received).toHaveLength(2);
    expect(received[0]).toContain(traceId);
    expect(spans.map((span) => span.name)).toEqual(["GET", "request"]);
  });

  it("exports to Google Cloud with application default credentials", async () => {
    const telemetry = startTelemetry({ serviceName: "platform", enabled: true, gcloudProjectId: "project" });

    trace.getTracer("test").startSpan("operation").end();
    await telemetry.shutdown();

    expect(exporters).toHaveLength(1);
    expect(exporters[0]?.config.url).toBe("https://telemetry.googleapis.com/v1/traces");
    await expect(exporters[0]?.config.headers()).resolves.toEqual({ authorization: "Bearer application-default" });
    expect(exporters[0]?.spans[0]?.resource.attributes).toMatchObject({
      "gcp.project_id": "project",
      "service.name": "platform",
    });
  });
});
