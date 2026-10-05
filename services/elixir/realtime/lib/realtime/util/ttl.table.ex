defmodule Realtime.Util.TtlTable do
  @moduledoc false
  use GenServer

  @default_sweep_ms 30_000

  def start_link(options) do
    name = Keyword.fetch!(options, :name)
    GenServer.start_link(__MODULE__, options, name: name)
  end

  def child_spec(options),
    do: %{id: Keyword.fetch!(options, :name), start: {__MODULE__, :start_link, [options]}}

  def put(table, key, value, ttl_ms) do
    :ets.insert(table, {key, value, now_ms() + ttl_ms})
    :ok
  rescue
    ArgumentError -> :ok
  end

  def get(table, key) do
    now = now_ms()

    case :ets.lookup(table, key) do
      [{^key, value, expires_at}] when expires_at > now -> {:ok, value}
      _ -> :miss
    end
  rescue
    ArgumentError -> :miss
  end

  def delete(table, key) do
    :ets.delete(table, key)
    :ok
  rescue
    ArgumentError -> :ok
  end

  def broadcast_put(topic, key, value, ttl_ms),
    do: Phoenix.PubSub.broadcast(Realtime.PubSub, topic, {:ttl_table_put, key, value, ttl_ms})

  @impl true
  def init(options) do
    table = Keyword.fetch!(options, :name)
    :ets.new(table, [:named_table, :public, :set, read_concurrency: true])
    if topic = options[:subscribe], do: Phoenix.PubSub.subscribe(Realtime.PubSub, topic)
    sweep_ms = Keyword.get(options, :sweep_ms, @default_sweep_ms)
    Process.send_after(self(), :sweep, sweep_ms)
    {:ok, %{table: table, sweep_ms: sweep_ms}}
  end

  @impl true
  def handle_info({:ttl_table_put, key, value, ttl_ms}, state) do
    put(state.table, key, value, ttl_ms)
    {:noreply, state}
  end

  def handle_info(:sweep, state) do
    :ets.select_delete(state.table, [{{:_, :_, :"$1"}, [{:<, :"$1", now_ms()}], [true]}])
    Process.send_after(self(), :sweep, state.sweep_ms)
    {:noreply, state}
  end

  def handle_info(_message, state), do: {:noreply, state}

  defp now_ms, do: System.monotonic_time(:millisecond)
end
