defmodule Realtime.Events.AmqpConsumer do
  use GenServer
  require Logger

  alias Realtime.Events.{DomainEventRouter, RetryPolicy}

  @dedupe_window 10_000

  def start_link(options),
    do: GenServer.start_link(__MODULE__, options, Keyword.take(options, [:name]))

  @impl true
  def init(options) do
    Process.flag(:trap_exit, true)

    state = %{
      client: Keyword.fetch!(options, :client),
      settings: Keyword.get(options, :settings, []),
      queue_name: Keyword.fetch!(options, :queue_name),
      prefetch: Keyword.get(options, :prefetch, 50),
      broadcast: Keyword.get(options, :broadcast, &DomainEventRouter.broadcast_domain_event/1),
      backoff: Keyword.get(options, :backoff, &reconnect_delay_ms/1),
      channel: nil,
      monitor: nil,
      reconnect_attempt: 0,
      seen_ids: MapSet.new(),
      seen_order: :queue.new()
    }

    {:ok, state, {:continue, :connect}}
  end

  @impl true
  def handle_continue(:connect, state), do: connect(state)

  @impl true
  def handle_call(:connected?, _from, state), do: {:reply, state.channel != nil, state}

  @impl true
  def handle_info(:connect, state), do: connect(state)

  def handle_info({:basic_consume_ok, _meta}, state), do: {:noreply, state}

  def handle_info({:basic_cancel, _meta}, state), do: reconnect_later(state, :consumer_cancelled)

  def handle_info({:basic_return, _payload, meta}, state) do
    Logger.error("retry was unroutable: #{inspect(Map.get(meta, :routing_key))}")
    {:noreply, state}
  end

  def handle_info({:basic_deliver, payload, meta}, %{channel: channel} = state)
      when not is_nil(channel),
      do: {:noreply, handle_delivery(payload, meta, state)}

  def handle_info({:DOWN, ref, :process, _pid, reason}, %{monitor: ref} = state),
    do: reconnect_later(%{state | channel: nil, monitor: nil}, reason)

  def handle_info(_message, state), do: {:noreply, state}

  @impl true
  def terminate(_reason, %{channel: nil}), do: :ok
  def terminate(_reason, state), do: state.client.close(state.channel)

  defp connect(state) do
    with {:ok, channel} <- state.client.open(state.settings),
         monitor = Process.monitor(state.client.channel_process(channel)),
         {:ok, _tag} <- consume_or_close(state, channel, monitor) do
      {:noreply, %{state | channel: channel, monitor: monitor, reconnect_attempt: 0}}
    else
      {:error, reason} -> reconnect_later(state, reason)
    end
  end

  defp consume_or_close(state, channel, monitor) do
    case state.client.consume(channel, state.queue_name, state.prefetch) do
      {:ok, tag} ->
        {:ok, tag}

      error ->
        Process.demonitor(monitor, [:flush])
        state.client.close(channel)
        error
    end
  end

  defp reconnect_later(state, reason) do
    delay = state.backoff.(state.reconnect_attempt)
    Logger.warning("realtime queue unavailable, reconnecting in #{delay}ms: #{inspect(reason)}")
    Process.send_after(self(), :connect, delay)
    {:noreply, %{state | reconnect_attempt: state.reconnect_attempt + 1}}
  end

  defp handle_delivery(payload, meta, state) do
    case decode_envelope(payload) do
      {:ok, id, envelope} -> deliver_once(id, envelope, payload, meta, state)
      {:error, reason} -> dead_letter_poison(meta, reason, state)
    end
  end

  defp decode_envelope(payload) do
    case Jason.decode(payload) do
      {:ok, %{"id" => id, "type" => type, "data" => %{}} = envelope}
      when is_binary(id) and is_binary(type) ->
        {:ok, id, envelope}

      {:ok, _other} ->
        {:error, :malformed_envelope}

      {:error, reason} ->
        {:error, {:invalid_json, reason}}
    end
  end

  defp deliver_once(id, envelope, payload, meta, state) do
    if MapSet.member?(state.seen_ids, id) do
      settle(state.client.ack(state.channel, meta.delivery_tag))
      state
    else
      broadcast_and_settle(id, envelope, payload, meta, state)
    end
  end

  defp broadcast_and_settle(id, envelope, payload, meta, state) do
    state.broadcast.(envelope)
    settle(state.client.ack(state.channel, meta.delivery_tag))
    remember_envelope_id(state, id)
  rescue
    error ->
      retry_or_dead_letter(payload, meta, error, state)
      state
  end

  defp dead_letter_poison(meta, reason, state) do
    Logger.warning("poison domain event dead-lettered: #{inspect(reason)}")
    settle(state.client.reject(state.channel, meta.delivery_tag, false))
    state
  end

  defp retry_or_dead_letter(payload, meta, error, state) do
    failed_attempt = RetryPolicy.attempt_from_headers(Map.get(meta, :headers)) + 1

    case RetryPolicy.tier_after_failed_attempt(failed_attempt) do
      {:ok, tier} ->
        schedule_retry(payload, meta, error, failed_attempt, tier, state)

      :dead_letter ->
        Logger.error("domain event dead-lettered after #{failed_attempt} attempts")
        settle(state.client.reject(state.channel, meta.delivery_tag, false))
    end
  end

  defp schedule_retry(payload, meta, error, failed_attempt, tier, state) do
    options = [
      headers: RetryPolicy.headers_for_retry(Map.get(meta, :headers), failed_attempt, error),
      message_id: present(Map.get(meta, :message_id)),
      type: present(Map.get(meta, :type)),
      content_type: present(Map.get(meta, :content_type))
    ]

    routing_key = RetryPolicy.retry_queue_name(state.queue_name, tier)
    retry_options = Enum.reject(options, fn {_key, value} -> is_nil(value) end)

    case state.client.publish_confirmed(
           state.channel,
           RetryPolicy.retry_exchange(),
           routing_key,
           payload,
           retry_options
         ) do
      :ok ->
        Logger.warning("domain event broadcast failed, retry in #{tier}: #{inspect(error)}")
        settle(state.client.ack(state.channel, meta.delivery_tag))

      {:error, reason} ->
        Logger.warning("retry not scheduled, requeueing: #{inspect(reason)}")
        settle(state.client.reject(state.channel, meta.delivery_tag, true))
    end
  end

  defp present(:undefined), do: nil
  defp present(value), do: value

  defp settle(:ok), do: :ok
  defp settle(other), do: Logger.warning("settling a delivery failed: #{inspect(other)}")

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

  defp reconnect_delay_ms(attempt) do
    base = min(30_000, 500 * Integer.pow(2, min(attempt, 6)))
    div(base, 2) + :rand.uniform(div(base, 2))
  end
end
