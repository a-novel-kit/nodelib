import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  AlwaysOnSampler,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  NodeTracerProvider,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { GoogleAuth } from "google-auth-library";

/** The OTLP traces endpoint of Google Cloud's Telemetry API. */
const gcloudTracesUrl = "https://telemetry.googleapis.com/v1/traces";

/** Span attributes that hold a URL or its query string. */
const urlAttributes = ["http.url", "url.full", "url.query"];

/** TelemetryOptions selects whether a platform server traces, and where its spans go. */
export interface TelemetryOptions {
  /** Names the platform on every span, as the `service.name` resource attribute. */
  serviceName: string;
  /** Records and exports spans. When false, nothing is installed and every span is a no-op. */
  enabled: boolean;
  /** Exports to this Google Cloud project. Without it, spans print to standard output. */
  gcloudProjectId?: string;
}

/** Telemetry is the tracing setup started by {@link startTelemetry}. */
export interface Telemetry {
  /** Exports the spans still buffered and stops tracing. Await it before the process exits. */
  shutdown(): Promise<void>;
}

/**
 * Starts tracing for a platform server. Call it from `src/instrumentation.server.ts`, which SvelteKit
 * loads before the application.
 *
 * Every trace is kept, since Cloud Run stamps its own sampling decision on each request. A global
 * `fetch` made while handling a request gets a client span and sends the trace context to the server
 * it calls. Recorded URLs keep their parameter names, but every query value becomes `REDACTED`,
 * because links carry credentials.
 */
export function startTelemetry(options: TelemetryOptions): Telemetry {
  if (!options.enabled) return { shutdown: async () => {} };

  // Without a logger, a failed export is silent.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      "service.name": options.serviceName,
      ...(options.gcloudProjectId && { "gcp.project_id": options.gcloudProjectId }),
    }),
    sampler: new AlwaysOnSampler(),
    spanProcessors: [redactUrls, new BatchSpanProcessor(spanExporter(options.gcloudProjectId))],
  });

  provider.register();

  const unregister = registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [new UndiciInstrumentation({ requireParentforSpans: true })],
  });

  return {
    shutdown: async () => {
      unregister();
      await provider.shutdown();
    },
  };
}

function spanExporter(gcloudProjectId: string | undefined): SpanExporter {
  if (!gcloudProjectId) return new ConsoleSpanExporter();

  const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });

  return new OTLPTraceExporter({
    url: gcloudTracesUrl,
    // Access tokens expire, and the client refreshes them, so each export reads them again.
    headers: async () => Object.fromEntries((await auth.getRequestHeaders()).entries()),
  });
}

function redactQuery(url: string): string {
  return url.replace(/([?&][^=&#]*)=[^&#]*/g, "$1=REDACTED");
}

/** Redacts URL attributes as each span starts, before any exporter can read them. */
const redactUrls: SpanProcessor = {
  onStart(span) {
    for (const name of urlAttributes) {
      const value = span.attributes[name];
      if (typeof value === "string") span.setAttribute(name, redactQuery(value));
    }
  },
  onEnd() {},
  forceFlush: async () => {},
  shutdown: async () => {},
};
