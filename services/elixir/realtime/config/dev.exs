import Config

config :realtime, RealtimeWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}],
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "local-development-only-secret-key-base-that-is-at-least-64-bytes-long-000",
  watchers: []

config :realtime, :allowed_origins, ["*"]
config :phoenix, :plug_init_mode, :runtime
