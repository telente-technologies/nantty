defmodule Realtime.Presence do
  use Phoenix.Presence, otp_app: :realtime, pubsub_server: Realtime.PubSub

  alias Realtime.Presence.LivePresenceForwarder

  def init(_options), do: {:ok, %{}}

  def handle_metas("live:" <> live_id, %{joins: joins, leaves: leaves}, presences, state) do
    joined = Map.keys(joins)
    left = leaves |> Map.keys() |> Enum.reject(&Map.has_key?(presences, &1))
    LivePresenceForwarder.record_change(live_id, joined, left)
    {:ok, state}
  end

  def handle_metas(_topic, _diff, _presences, state), do: {:ok, state}
end
