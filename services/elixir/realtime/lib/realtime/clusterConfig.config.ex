defmodule Realtime.ClusterConfig do
  @moduledoc false

  @doc """
  Requires explicit Erlang discovery and authentication settings for production.

  A missing DNS query silently makes each release task an isolated PubSub node;
  a missing cookie prevents those nodes from safely joining one cluster.
  """
  def production_settings!(environment) when is_map(environment) do
    %{
      dns_cluster_query: environment |> required!("DNS_CLUSTER_QUERY") |> String.trim(),
      release_cookie: required!(environment, "RELEASE_COOKIE")
    }
  end

  defp required!(environment, name) do
    case Map.get(environment, name) do
      value when is_binary(value) ->
        if String.trim(value) == "" do
          raise ArgumentError, "#{name} must be configured for the realtime production cluster"
        end

        value

      _ ->
        raise ArgumentError, "#{name} must be configured for the realtime production cluster"
    end
  end
end
