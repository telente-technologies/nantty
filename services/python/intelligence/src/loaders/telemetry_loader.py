import os

from fastapi import FastAPI
from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.metrics import MeterProvider
from opentelemetry.sdk.metrics import MeterProvider as SdkMeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import TracerProvider as ApiTracerProvider

HEALTH_PATHS_EXCLUDED_FROM_TELEMETRY = "/health/live,/health/ready"
METRIC_EXPORT_INTERVAL_MILLISECONDS = 60_000


def instrument_application(
    application: FastAPI, tracer_provider: ApiTracerProvider, meter_provider: MeterProvider
) -> None:
    FastAPIInstrumentor.instrument_app(
        application,
        tracer_provider=tracer_provider,
        meter_provider=meter_provider,
        excluded_urls=HEALTH_PATHS_EXCLUDED_FROM_TELEMETRY,
    )


def configure_telemetry_when_collector_is_set(application: FastAPI) -> bool:
    if not os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return False
    resource = Resource.create({"service.name": os.environ.get("OTEL_SERVICE_NAME", "intelligence")})
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    meter_provider = SdkMeterProvider(
        resource=resource,
        metric_readers=[
            PeriodicExportingMetricReader(
                OTLPMetricExporter(), export_interval_millis=METRIC_EXPORT_INTERVAL_MILLISECONDS
            )
        ],
    )
    trace.set_tracer_provider(tracer_provider)
    metrics.set_meter_provider(meter_provider)
    instrument_application(application, tracer_provider, meter_provider)
    return True
