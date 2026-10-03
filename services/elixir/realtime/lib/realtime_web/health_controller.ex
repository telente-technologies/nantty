defmodule RealtimeWeb.HealthController do
  use RealtimeWeb, :controller

  def show(conn, _params), do: json(conn, %{status: "up", service: "realtime"})
end
