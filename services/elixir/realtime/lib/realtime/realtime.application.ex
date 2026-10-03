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
        {Realtime.Auth.JwksKeyCache, Application.fetch_env!(:realtime, :access_token)},
        Realtime.Events.Throttle,
        RealtimeWeb.Endpoint
      ] ++ sqs_consumer_children()

    Supervisor.start_link(children, strategy: :one_for_one, name: Realtime.Supervisor)
  end

  defp sqs_consumer_children do
    settings = Application.get_env(:realtime, :sqs, [])

    if settings[:enabled] do
      [
        {Realtime.Events.SqsConsumer,
         client: Realtime.Events.SqsQueueClient, queue_name: settings[:queue_name]}
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
