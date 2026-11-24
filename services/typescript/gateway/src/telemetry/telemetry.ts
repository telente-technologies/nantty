import { context, createNoopMeter, metrics, trace, type MeterProvider as ApiMeterProvider } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations, type Instrumentation } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { detectResources, envDetector, resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";

export type StopTelemetry = () => Promise<void>;

const instrumentationMeters: ApiMeterProvider = { getMeter: () => createNoopMeter() };

function createInstrumentations(): Instrumentation[] {
  return [new HttpInstrumentation()];
}

export function startTelemetry(serviceName: string, environment: NodeJS.ProcessEnv = process.env): StopTelemetry {
  if ((environment["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "").trim() === "") return async () => undefined;
  const resource = resourceFromAttributes({ "service.name": serviceName }).merge(detectResources({ detectors: [envDetector] }));
  const contextManager = new AsyncLocalStorageContextManager();
  contextManager.enable();
  context.setGlobalContextManager(contextManager);
  const tracerProvider = new TracerProvider({ resource, spanProcessors: [new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })] });
  trace.setGlobalTracerProvider(tracerProvider);
  const meterProvider = new MeterProvider({ resource, readers: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: 60_000 })] });
  metrics.setGlobalMeterProvider(meterProvider);
  // RED metrics come from requestMetrics.ts; instrumentation metrics are dropped to avoid duplicate series.
  const disableInstrumentations = registerInstrumentations({ tracerProvider, meterProvider: instrumentationMeters, instrumentations: createInstrumentations() });
  return async () => {
    disableInstrumentations();
    await Promise.allSettled([tracerProvider.shutdown(), meterProvider.shutdown()]);
  };
}
