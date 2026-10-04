defmodule Realtime.Presence.LivePresenceForwarder do
  @moduledoc false
  use GenServer

  @default_flush_ms 1_000

  def start_link(options),
    do: GenServer.start_link(__MODULE__, options, name: Keyword.get(options, :name, __MODULE__))

  def record_change(server \\ __MODULE__, live_id, joined, left) do
    if Process.whereis(server),
      do: GenServer.cast(server, {:change, live_id, joined, left}),
      else: :ok
  end

  @impl true
  def init(options) do
    flush_ms = Keyword.get(options, :flush_ms, @default_flush_ms)
    client = Keyword.get(options, :client, Realtime.Presence.LivePresenceClient)
    Process.send_after(self(), :flush, flush_ms)
    {:ok, %{pending: %{}, flush_ms: flush_ms, client: client}}
  end

  @impl true
  def handle_cast({:change, live_id, joined, left}, state) do
    {pending_joined, pending_left} = Map.get(state.pending, live_id, {MapSet.new(), MapSet.new()})

    joined_set =
      MapSet.union(MapSet.difference(pending_joined, MapSet.new(left)), MapSet.new(joined))

    left_set = MapSet.union(MapSet.difference(pending_left, MapSet.new(joined)), MapSet.new(left))

    {:noreply, %{state | pending: Map.put(state.pending, live_id, {joined_set, left_set})}}
  end

  @impl true
  def handle_info(:flush, state) do
    for {live_id, {joined, left}} <- state.pending do
      Task.start(fn ->
        state.client.send_presence_change(live_id, MapSet.to_list(joined), MapSet.to_list(left))
      end)
    end

    Process.send_after(self(), :flush, state.flush_ms)
    {:noreply, %{state | pending: %{}}}
  end
end
