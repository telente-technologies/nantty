defmodule Realtime.Events.SqsConsumer do
  use GenServer
  require Logger

  alias Realtime.Events.DomainEventRouter

  @dedupe_window 10_000

  def start_link(options),
    do: GenServer.start_link(__MODULE__, options, Keyword.take(options, [:name]))

  @impl true
  def init(options) do
    state = %{
      client: Keyword.fetch!(options, :client),
      queue_name: Keyword.fetch!(options, :queue_name),
      broadcast: Keyword.get(options, :broadcast, &DomainEventRouter.broadcast_domain_event/1),
      idle_delay_ms: Keyword.get(options, :idle_delay_ms, 0),
      error_delay_ms: Keyword.get(options, :error_delay_ms, 5_000),
      queue_url: nil,
      seen_ids: MapSet.new(),
      seen_order: :queue.new()
    }

    {:ok, state, {:continue, :poll}}
  end

  @impl true
  def handle_continue(:poll, state), do: poll_once(state)

  @impl true
  def handle_info(:poll, state), do: poll_once(state)

  defp poll_once(%{queue_url: nil} = state) do
    case state.client.resolve_queue_url(state.queue_name) do
      {:ok, url} -> poll_once(%{state | queue_url: url})
      {:error, reason} -> retry_later(state, reason)
    end
  end

  defp poll_once(state) do
    case state.client.receive_messages(state.queue_url) do
      {:ok, []} -> schedule_poll(state, state.idle_delay_ms)
      {:ok, messages} -> messages |> Enum.reduce(state, &process_message/2) |> schedule_poll(0)
      {:error, reason} -> retry_later(state, reason)
    end
  end

  defp process_message(message, state) do
    case handle_envelope(message.body, state) do
      {:ok, state} ->
        delete_acknowledged_message(state, message)
        state

      {:error, reason} ->
        Logger.warning("domain event not processed: #{inspect(reason)}")
        state
    end
  end

  defp handle_envelope(body, state) do
    with {:ok, %{"id" => id, "type" => type, "data" => %{}} = envelope}
         when is_binary(id) and is_binary(type) <- Jason.decode(body) do
      if MapSet.member?(state.seen_ids, id),
        do: {:ok, state},
        else: deliver_once(envelope, id, state)
    else
      {:ok, _other} -> {:error, :malformed_envelope}
      {:error, reason} -> {:error, {:invalid_json, reason}}
    end
  end

  defp deliver_once(envelope, id, state) do
    state.broadcast.(envelope)
    {:ok, remember_envelope_id(state, id)}
  rescue
    error -> {:error, error}
  end

  defp remember_envelope_id(state, id) do
    seen_ids = MapSet.put(state.seen_ids, id)
    seen_order = :queue.in(id, state.seen_order)

    if MapSet.size(seen_ids) > @dedupe_window do
      {{:value, oldest}, trimmed} = :queue.out(seen_order)
      %{state | seen_ids: MapSet.delete(seen_ids, oldest), seen_order: trimmed}
    else
      %{state | seen_ids: seen_ids, seen_order: seen_order}
    end
  end

  defp delete_acknowledged_message(state, message) do
    case state.client.delete_message(state.queue_url, message.receipt_handle) do
      :ok -> :ok
      {:error, reason} -> Logger.warning("delete from queue failed: #{inspect(reason)}")
    end
  end

  defp retry_later(state, reason) do
    Logger.warning("realtime queue unavailable: #{inspect(reason)}")
    schedule_poll(state, state.error_delay_ms)
  end

  defp schedule_poll(state, delay_ms) do
    Process.send_after(self(), :poll, delay_ms)
    {:noreply, state}
  end
end
