defmodule RealtimeWeb.ReadinessHttpTest do
  use ExUnit.Case, async: false
  import Phoenix.ConnTest

  @endpoint RealtimeWeb.Endpoint

  test "liveness stays healthy while broker-dependent readiness reports degradation" do
    previous = Application.get_env(:realtime, :amqp)
    Application.put_env(:realtime, :amqp, enabled: true)

    on_exit(fn ->
      if previous,
        do: Application.put_env(:realtime, :amqp, previous),
        else: Application.delete_env(:realtime, :amqp)
    end)

    assert (build_conn() |> get("/healthz")).status == 200
    assert (build_conn() |> get("/readyz")).status == 503
  end
end
