defmodule RealtimeWeb.HealthController do
  use RealtimeWeb, :controller

  def show(conn, _params), do: json(conn, %{status: "up", service: "realtime"})

  def metrics(conn, _params) do
    if conn.remote_ip in [{127, 0, 0, 1}, {0, 0, 0, 0, 0, 0, 0, 1}] and
         get_req_header(conn, "x-forwarded-for") == [] do
      conn
      |> put_resp_content_type("text/plain")
      |> send_resp(
        200,
        TelemetryMetricsPrometheus.Core.scrape(RealtimeWeb.Telemetry.prometheus_name())
      )
    else
      send_resp(conn, 404, "")
    end
  end

  def ready(conn, _params) do
    case Realtime.Readiness.check() do
      :ok -> json(conn, %{status: "ready"})
      {:error, _dependency} -> conn |> put_status(503) |> json(%{status: "unavailable"})
    end
  end
end
