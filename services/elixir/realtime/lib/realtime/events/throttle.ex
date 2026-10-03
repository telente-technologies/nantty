defmodule Realtime.Events.Throttle do
  use GenServer

  @purge_threshold 5_000
  @purge_age_ms 60_000

  def start_link(options) do
    GenServer.start_link(__MODULE__, options, name: Keyword.get(options, :name, __MODULE__))
  end

  def submit(server \\ __MODULE__, key, interval_ms, deliver) when is_function(deliver, 0),
    do: GenServer.call(server, {:submit, key, interval_ms, deliver})

  @impl true
  def init(options) do
    {:ok,
     %{
       last_delivered_at: %{},
       pending: %{},
       clock: Keyword.get(options, :clock, fn -> System.monotonic_time(:millisecond) end),
       schedule_flush: Keyword.get(options, :schedule_flush, &schedule_flush_message/2)
     }}
  end

  @impl true
  def handle_call({:submit, key, interval_ms, deliver}, _from, state) do
    now = state.clock.()

    case Map.fetch(state.last_delivered_at, key) do
      {:ok, last} when now - last < interval_ms ->
        {:reply, :throttled, hold_latest(state, key, deliver, last + interval_ms - now)}

      _ ->
        run(deliver)
        {:reply, :delivered, record_delivery(state, key, now)}
    end
  end

  @impl true
  def handle_info({:flush, key}, state) do
    case Map.pop(state.pending, key) do
      {nil, _pending} ->
        {:noreply, state}

      {deliver, pending} ->
        run(deliver)
        {:noreply, record_delivery(%{state | pending: pending}, key, state.clock.())}
    end
  end

  def handle_info(_message, state), do: {:noreply, state}

  defp hold_latest(state, key, deliver, delay_ms) do
    if Map.has_key?(state.pending, key),
      do: %{state | pending: Map.put(state.pending, key, deliver)},
      else: schedule_and_hold(state, key, deliver, delay_ms)
  end

  defp schedule_and_hold(state, key, deliver, delay_ms) do
    state.schedule_flush.(key, max(delay_ms, 0))
    %{state | pending: Map.put(state.pending, key, deliver)}
  end

  defp record_delivery(state, key, now) do
    last = Map.put(state.last_delivered_at, key, now)

    if map_size(last) > @purge_threshold,
      do: %{state | last_delivered_at: drop_stale(last, now)},
      else: %{state | last_delivered_at: last}
  end

  defp drop_stale(last, now),
    do: Map.filter(last, fn {_key, delivered_at} -> now - delivered_at < @purge_age_ms end)

  defp schedule_flush_message(key, delay_ms),
    do: Process.send_after(self(), {:flush, key}, delay_ms)

  defp run(deliver) do
    deliver.()
  rescue
    _error -> :ok
  end
end
