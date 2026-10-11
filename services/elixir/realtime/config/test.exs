import Config

config :realtime, RealtimeWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "test-only-secret-key-base-that-is-at-least-64-bytes-long-0000000000000",
  server: false

config :realtime, :access_token,
  jwks_url: "",
  issuer: "https://auth.zudomart.test",
  audience: "zudomart-realtime",
  scope: "realtime"

config :logger, level: :warning
config :phoenix, :plug_init_mode, :runtime
config :realtime, :amqp, enabled: false
