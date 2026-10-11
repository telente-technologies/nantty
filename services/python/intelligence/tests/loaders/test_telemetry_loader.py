import httpx
import pytest
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader
from opentelemetry.sdk.trace import TracerProvider

from src.app import create_application
from src.configs.settings_config import IntelligenceSettings
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.loaders.telemetry_loader import configure_telemetry_when_collector_is_set, instrument_application


def collect_duration_points(reader: InMemoryMetricReader) -> list[dict[str, object]]:
    data = reader.get_metrics_data()
    points: list[dict[str, object]] = []
    for resource_metrics in data.resource_metrics if data else []:
        for scope_metrics in resource_metrics.scope_metrics:
            for metric in scope_metrics.metrics:
                if metric.name.startswith("http.server") and "duration" in metric.name:
                    points.extend(
                        {**dict(point.attributes or {}), "count": getattr(point, "count", 0)}
                        for point in metric.data.data_points
                    )
    return points


async def test_requests_are_recorded_as_red_metrics_by_route_template(
    intelligence_settings: IntelligenceSettings, feature_backend: InMemoryFeatureBackend
) -> None:
    application = create_application(intelligence_settings, feature_backend, start_background_tasks=False)
    reader = InMemoryMetricReader()
    instrument_application(application, TracerProvider(), MeterProvider(metric_readers=[reader]))
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(transport=transport, base_url="http://intelligence.internal") as client:
        await client.get("/v1/experiments/some-experiment-id/metrics")
        await client.get("/health/live")
    points = collect_duration_points(reader)
    assert points, "no request duration histogram was recorded"
    routes = {str(point.get("http.route")) for point in points}
    assert not any("some-experiment-id" in route for route in routes), routes
    assert all("health" not in route for route in routes), routes
    assert any(point.get("http.status_code") or point.get("http.response.status_code") for point in points)


def test_telemetry_is_a_no_op_without_a_collector(
    monkeypatch: pytest.MonkeyPatch,
    intelligence_settings: IntelligenceSettings,
    feature_backend: InMemoryFeatureBackend,
) -> None:
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    application = create_application(intelligence_settings, feature_backend, start_background_tasks=False)
    assert configure_telemetry_when_collector_is_set(application) is False
