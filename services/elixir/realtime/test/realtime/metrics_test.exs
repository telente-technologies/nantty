defmodule RealtimeWeb.MetricsTest do
  use ExUnit.Case, async: false
  import Plug.Conn
  import Phoenix.ConnTest

  @endpoint RealtimeWeb.Endpoint

  test "requests are recorded as RED metrics by route and served to the local collector only" do
    build_conn() |> get("/healthz")

    scrape = build_conn() |> Map.put(:remote_ip, {127, 0, 0, 1}) |> get("/metrics")
    assert scrape.status == 200

    assert scrape.resp_body =~
             ~s(http_server_request_duration_seconds_count{method="GET",route="/healthz",status_class="2xx"})

    forwarded =
      build_conn()
      |> Map.put(:remote_ip, {127, 0, 0, 1})
      |> put_req_header("x-forwarded-for", "203.0.113.9")
      |> get("/metrics")

    assert forwarded.status == 404
    assert (build_conn() |> Map.put(:remote_ip, {10, 0, 1, 7}) |> get("/metrics")).status == 404
  end
end
