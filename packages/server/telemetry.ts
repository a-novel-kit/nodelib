import {
  type Attributes,
  type Context,
  DiagConsoleLogger,
  DiagLogLevel,
  type SpanKind,
  diag,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  NodeTracerProvider,
  NoopSpanProcessor,
  ParentBasedSampler,
  type Sampler,
  SamplingDecision,
  type SamplingResult,
  type Span,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-node";

/** Span attributes that hold a URL or its query string. */
const urlAttributes = ["http.url", "url.full", "url.query"];

/** TelemetryOptions selects whether a platform server traces, and which requests it leaves out. */
export interface TelemetryOptions {
  /** Names the platform on every span, as the `service.name` resource attribute. */
  serviceName: string;
  /** Records and exports spans. When false, nothing is installed and every span is a no-op. */
  enabled: boolean;
  /** Lists the routes whose requests produce no span, such as a liveness probe's `/ping`. */
  untracedRoutes?: string[];
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
 * Spans export over OTLP/HTTP once `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and print to standard output
 * otherwise. Every trace is kept, even one its caller did not sample, except the requests to an
 * untraced route. A global `fetch` made while handling a request gets a client span and sends the
 * trace context to the server it calls. Recorded URLs keep their parameter names, but every query
 * value becomes `REDACTED`, because links carry credentials.
 */
export function startTelemetry(options: TelemetryOptions): Telemetry {
  if (!options.enabled) return { shutdown: async () => {} };

  // Without a logger, a failed export is silent.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ "service.name": options.serviceName }),
    sampler: keepEveryTrace(options.untracedRoutes ?? []),
    spanProcessors: [new UrlRedactor(), new BatchSpanProcessor(spanExporter())],
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

/** The OTLP exporter reads its endpoint, headers and compression from the `OTEL_EXPORTER_OTLP_*` variables. */
function spanExporter(): SpanExporter {
  return process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? new OTLPTraceExporter() : new ConsoleSpanExporter();
}

/**
 * Samples every request, whatever its caller decided, except those to an untraced route. The spans
 * under a dropped request follow it, as the parent-based default drops the children of an unsampled
 * local parent.
 */
function keepEveryTrace(untracedRoutes: string[]): Sampler {
  const sampler = new RouteSampler(new Set(untracedRoutes));
  return new ParentBasedSampler({ root: sampler, remoteParentSampled: sampler, remoteParentNotSampled: sampler });
}

/** Drops a span whose `http.route` is untraced, and records every other one. */
class RouteSampler implements Sampler {
  constructor(private readonly untracedRoutes: ReadonlySet<string>) {}

  shouldSample(
    _context: Context,
    _traceId: string,
    _name: string,
    _kind: SpanKind,
    attributes: Attributes
  ): SamplingResult {
    const route = attributes["http.route"];
    const untraced = typeof route === "string" && this.untracedRoutes.has(route);

    return { decision: untraced ? SamplingDecision.NOT_RECORD : SamplingDecision.RECORD_AND_SAMPLED };
  }
}

function redactQuery(url: string): string {
  return url.replace(/([?&][^=&#]*)=[^&#]*/g, "$1=REDACTED");
}

/** Redacts URL attributes as each span starts, before any exporter can read them. */
class UrlRedactor extends NoopSpanProcessor {
  override onStart(span: Span): void {
    for (const name of urlAttributes) {
      const value = span.attributes[name];
      if (typeof value === "string") span.setAttribute(name, redactQuery(value));
    }
  }
}
