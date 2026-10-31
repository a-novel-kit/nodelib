// @vitest-environment node
import { type TelemetryOptions, startTelemetry } from "./telemetry";

import { type IncomingMessage, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ROOT_CONTEXT, SpanKind, TraceFlags, context, propagation, trace } from "@opentelemetry/api";

afterEach(() => {
  trace.disable();
  propagation.disable();
  context.disable();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Runs fn with spans printed to standard output, and returns the spans it printed. */
async function printedSpans(
  fn: () => Promise<void>,
  options: Partial<TelemetryOptions> = {}
): Promise<{ name: string; kind: SpanKind; attributes: Record<string, unknown> }[]> {
  const dir = vi.spyOn(console, "dir").mockImplementation(() => {});
  const telemetry = startTelemetry({ serviceName: "platform", enabled: true, ...options });

  await fn();
  await telemetry.shutdown();

  return dir.mock.calls.map(([span]) => span as { name: string; kind: SpanKind; attributes: Record<string, unknown> });
}

/** Starts a server that records each request it receives, with its full body. */
async function recordingServer(): Promise<{
  url: string;
  requests: { request: IncomingMessage; body: Buffer }[];
  close: () => void;
}> {
  const requests: { request: IncomingMessage; body: Buffer }[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({ request, body: Buffer.concat(chunks) });
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    close: () => server.close(),
  };
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
    const server = await recordingServer();

    let traceId = "";
    const spans = await printedSpans(async () => {
      await trace.getTracer("test").startActiveSpan("request", async (span) => {
        traceId = span.spanContext().traceId;
        await fetch(`${server.url}/v2/ping`);
        span.end();
      });
      // Outside any request, a fetch records no span.
      await fetch(`${server.url}/v2/ping`);
    });
    server.close();

    expect(server.requests).toHaveLength(2);
    expect(server.requests[0]?.request.headers.traceparent).toContain(traceId);
    expect(spans.map((span) => span.name)).toEqual(["GET", "request"]);
  });

  it("makes SvelteKit's span for each request a server span", async () => {
    const spans = await printedSpans(async () => {
      trace.getTracer("sveltekit").startActiveSpan("sveltekit.handle.root", (span) => {
        trace.getTracer("sveltekit").startSpan("sveltekit.resolve").end();
        span.end();
      });
    });

    expect(spans.map(({ name, kind }) => ({ name, kind }))).toEqual([
      { name: "sveltekit.resolve", kind: SpanKind.INTERNAL },
      { name: "sveltekit.handle.root", kind: SpanKind.SERVER },
    ]);
  });

  it("keeps a trace its caller did not sample", async () => {
    const unsampled = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
      traceFlags: TraceFlags.NONE,
      isRemote: true,
    });

    const spans = await printedSpans(async () => {
      trace.getTracer("test").startSpan("request", {}, unsampled).end();
    });

    expect(spans.map((span) => span.name)).toEqual(["request"]);
  });

  it("labels spans with the standard resource variables", async () => {
    vi.stubEnv("OTEL_RESOURCE_ATTRIBUTES", "a_novel.workload=api");
    const dir = vi.spyOn(console, "dir").mockImplementation(() => {});

    const telemetry = startTelemetry({ serviceName: "platform", enabled: true });
    trace.getTracer("test").startSpan("operation").end();
    await telemetry.shutdown();

    const [span] = dir.mock.calls.map(([printed]) => printed as { resource: { attributes: Record<string, unknown> } });
    expect(span?.resource.attributes).toEqual({ "service.name": "platform", "a_novel.workload": "api" });
  });

  it("drops the requests to an untraced route with the spans under them", async () => {
    const spans = await printedSpans(
      async () => {
        for (const route of ["/ping", "/healthcheck"]) {
          trace
            .getTracer("test")
            .startActiveSpan(`request ${route}`, { attributes: { "http.route": route } }, (span) => {
              trace.getTracer("test").startSpan(`resolve ${route}`).end();
              span.end();
            });
        }
      },
      { untracedRoutes: ["/ping"] }
    );

    expect(spans.map((span) => span.name)).toEqual(["resolve /healthcheck", "request /healthcheck"]);
  });

  it("exports over OTLP with the standard variables once an endpoint is set", async () => {
    const server = await recordingServer();
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", `${server.url}/api/1/integration/otlp`);
    vi.stubEnv("OTEL_EXPORTER_OTLP_HEADERS", "x-sentry-auth=sentry sentry_key=public");
    vi.stubEnv("OTEL_EXPORTER_OTLP_COMPRESSION", "gzip");

    const telemetry = startTelemetry({ serviceName: "platform", enabled: true });
    trace.getTracer("test").startSpan("operation").end();
    await telemetry.shutdown();
    server.close();

    expect(server.requests).toHaveLength(1);
    const [{ request, body }] = server.requests as [(typeof server.requests)[number]];
    expect(request.url).toBe("/api/1/integration/otlp/v1/traces");
    expect(request.headers).toMatchObject({
      "content-encoding": "gzip",
      "content-type": "application/x-protobuf",
      "x-sentry-auth": "sentry sentry_key=public",
    });
    // Protobuf keeps strings as raw UTF-8, so the decompressed export carries the names as is.
    const payload = gunzipSync(body).toString("utf8");
    expect(payload).toContain("platform");
    expect(payload).toContain("operation");
  });
});
