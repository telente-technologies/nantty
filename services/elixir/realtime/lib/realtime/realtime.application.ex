defmodule Realtime.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    children =
      [
        RealtimeWeb.Telemetry,
        {DNSCluster, query: Application.get_env(:realtime, :dns_cluster_query) || :ignore},
        {Phoenix.PubSub, name: Realtime.PubSub},
        Realtime.Presence,
        Realtime.Presence.LivePresenceForwarder,
        {Realtime.Auth.JwksKeyCache, Application.fetch_env!(:realtime, :access_token)},
        Realtime.Events.Throttle,
        RealtimeWeb.Endpoint
      ] ++ domain_event_consumer_children()

    Supervisor.start_link(children, strategy: :one_for_one, name: Realtime.Supervisor)
  end

  defp domain_event_consumer_children do
    settings = Application.get_env(:realtime, :amqp, [])

    if settings[:enabled] do
      [
        {Realtime.Events.AmqpConsumer,
         client: Realtime.Events.AmqpBrokerClient,
         settings: [url: settings[:url]],
         queue_name: settings[:queue_name],
         prefetch: settings[:prefetch]}
      ]
    else
      []
    end
  end

  @impl true
  def config_change(changed, _new, removed) do
    RealtimeWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
