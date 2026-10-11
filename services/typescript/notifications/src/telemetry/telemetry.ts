import { createNoopMeter, metrics, type MeterProvider as ApiMeterProvider } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations, type Instrumentation } from "@opentelemetry/instrumentation";
import { AmqplibInstrumentation } from "@opentelemetry/instrumentation-amqplib";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { detectResources, envDetector, resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

export type StopTelemetry = () => Promise<void>;

const instrumentationMeters: ApiMeterProvider = { getMeter: () => createNoopMeter() };

function createInstrumentations(): Instrumentation[] {
  return [new HttpInstrumentation(), new AmqplibInstrumentation()];
}

export function startTelemetry(serviceName: string, environment: NodeJS.ProcessEnv = process.env): StopTelemetry {
  if ((environment["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "").trim() === "") return async () => undefined;
  const resource = resourceFromAttributes({ "service.name": serviceName }).merge(detectResources({ detectors: [envDetector] }));
  const tracerProvider = new NodeTracerProvider({ resource, spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())] });
  tracerProvider.register();
  const meterProvider = new MeterProvider({ resource, readers: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: 60_000 })] });
  metrics.setGlobalMeterProvider(meterProvider);
  // RED metrics come from requestMetrics.ts; instrumentation metrics are dropped to avoid duplicate series.
  const disableInstrumentations = registerInstrumentations({ tracerProvider, meterProvider: instrumentationMeters, instrumentations: createInstrumentations() });
  return async () => {
    disableInstrumentations();
    await Promise.allSettled([tracerProvider.shutdown(), meterProvider.shutdown()]);
  };
}
