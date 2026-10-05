defmodule RealtimeWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :realtime

  socket "/ws", RealtimeWeb.ClientSocket,
    websocket: [
      path: "",
      timeout: 60_000,
      max_frame_size: 16_384,
      check_origin: {RealtimeWeb.OriginPolicy, :allowed_origin?, []}
    ],
    longpoll: false

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]
  plug RealtimeWeb.Router
end
