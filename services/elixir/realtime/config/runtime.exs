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
  aws_region = System.get_env("AWS_REGION", "eu-west-1")

  default_sqs_endpoint =
    if config_env() == :prod,
      do: "https://sqs.#{aws_region}.amazonaws.com",
      else: "http://localhost:14566"

  config :realtime, :sqs,
    enabled: System.get_env("REALTIME_SQS_ENABLED", "true") != "false",
    queue_name: System.get_env("REALTIME_SQS_QUEUE_NAME", "realtime-domain-events"),
    endpoint: System.get_env("AWS_ENDPOINT_URL", default_sqs_endpoint),
    region: aws_region,
    access_key_id: System.get_env("AWS_ACCESS_KEY_ID", "test"),
    secret_access_key: System.get_env("AWS_SECRET_ACCESS_KEY", "test")
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
