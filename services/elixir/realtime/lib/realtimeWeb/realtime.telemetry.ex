defmodule RealtimeWeb.Telemetry do
  use Supervisor
  import Telemetry.Metrics

  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @impl true
  def init(_arg) do
    children = [
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000},
      {TelemetryMetricsPrometheus.Core, metrics: prometheus_metrics(), name: prometheus_name()}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  def metrics do
    [
      summary("phoenix.endpoint.start.system_time",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.endpoint.stop.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.start.system_time",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.exception.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.stop.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.socket_connected.duration",
        unit: {:native, :millisecond}
      ),
      sum("phoenix.socket_drain.count"),
      summary("phoenix.channel_joined.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.channel_handled_in.duration",
        tags: [:event],
        unit: {:native, :millisecond}
      ),
      summary("vm.memory.total", unit: {:byte, :kilobyte}),
      summary("vm.total_run_queue_lengths.total"),
      summary("vm.total_run_queue_lengths.cpu"),
      summary("vm.total_run_queue_lengths.io")
    ]
  end

  def prometheus_name, do: :realtime_prometheus_metrics

  def prometheus_metrics do
    [
      distribution("http.server.request.duration.seconds",
        event_name: [:phoenix, :router_dispatch, :stop],
        measurement: :duration,
        unit: {:native, :second},
        tags: [:method, :route, :status_class],
        tag_values: &request_tags/1,
        reporter_options: [buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]]
      ),
      counter("realtime.socket.connected.total", event_name: [:phoenix, :socket_connected]),
      last_value("vm.memory.total.bytes", event_name: [:vm, :memory], measurement: :total)
    ]
  end

  defp request_tags(%{conn: conn, route: route}),
    do: %{method: conn.method, route: route, status_class: "#{div(conn.status || 0, 100)}xx"}

  defp request_tags(_metadata), do: %{method: "unknown", route: "unmatched", status_class: "0xx"}

  defp periodic_measurements do
    []
  end
end
