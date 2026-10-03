import Config

if System.get_env("PHX_SERVER"), do: config(:realtime, RealtimeWeb.Endpoint, server: true)

config :realtime, RealtimeWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

if config_env() != :test do
  config :realtime, :access_token,
    jwks_url: System.get_env("AUTH_JWKS_URL", "http://localhost:8101/.well-known/jwks.json"),
    issuer: System.get_env("AUTH_TOKEN_ISSUER", "http://localhost:8101"),
    audience: System.get_env("AUTH_TOKEN_AUDIENCE", "zudomart-api")
end

if config_env() != :test do
  config :realtime, :live_internal,
    url: System.get_env("LIVE_INTERNAL_URL", "http://localhost:8110"),
    token: System.get_env("LIVE_INTERNAL_API_TOKEN", "")
end

if config_env() != :test do
  local_rabbitmq_url = "amqp://realtime:realtime-local-only@localhost:5672/zudomart"

  config :realtime, :amqp,
    enabled: System.get_env("REALTIME_AMQP_ENABLED", "true") != "false",
    url: System.get_env("RABBITMQ_URL", local_rabbitmq_url),
    queue_name: System.get_env("REALTIME_QUEUE_NAME", "realtime-domain-events"),
    prefetch: String.to_integer(System.get_env("RABBITMQ_PREFETCH", "50"))
end

if config_env() == :prod do
  config :realtime, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :realtime,
         :allowed_origins,
         String.split(System.fetch_env!("ALLOWED_ORIGINS"), ",", trim: true)

  config :realtime, RealtimeWeb.Endpoint,
    url: [host: System.fetch_env!("PHX_HOST"), port: 443, scheme: "https"],
    http: [ip: {0, 0, 0, 0, 0, 0, 0, 0}],
    secret_key_base: System.fetch_env!("SECRET_KEY_BASE")
end
