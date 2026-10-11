import Config

config :realtime, RealtimeWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [formats: [json: RealtimeWeb.ErrorJSON], layout: false],
  pubsub_server: Realtime.PubSub

config :realtime, :access_token,
  jwks_url: "",
  issuer: "http://localhost:8101",
  audience: "zudomart-realtime",
  scope: "realtime"

config :realtime, :live_internal, url: "", token: ""
config :realtime, :social_internal, url: "", token: ""

config :realtime, :allowed_origins, ["http://localhost:3000"]

config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
