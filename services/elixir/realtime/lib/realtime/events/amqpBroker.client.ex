defmodule Realtime.Events.AmqpBrokerClient do
  @behaviour Realtime.Events.BrokerClient

  @confirm_timeout_ms 5_000

  @impl true
  def open(settings) do
    with {:ok, connection} <-
           AMQP.Connection.open(Keyword.fetch!(settings, :url), name: "realtime"),
         {:ok, channel} <- open_confirm_channel(connection) do
      {:ok, channel}
    end
  end

  defp open_confirm_channel(connection) do
    with {:ok, channel} <- AMQP.Channel.open(connection),
         :ok <- AMQP.Confirm.select(channel),
         :ok <- AMQP.Confirm.register_handler(channel, self()),
         :ok <- AMQP.Basic.return(channel, self()) do
      {:ok, channel}
    else
      error ->
        AMQP.Connection.close(connection)
        error
    end
  end

  @impl true
  def channel_process(%AMQP.Channel{pid: pid}), do: pid

  @impl true
  def consume(channel, queue, prefetch) do
    with :ok <- AMQP.Basic.qos(channel, prefetch_count: prefetch),
         do: AMQP.Basic.consume(channel, queue, nil, no_ack: false)
  end

  @impl true
  def ack(channel, delivery_tag), do: AMQP.Basic.ack(channel, delivery_tag)

  @impl true
  def reject(channel, delivery_tag, requeue),
    do: AMQP.Basic.reject(channel, delivery_tag, requeue: requeue)

  @impl true
  def publish_confirmed(channel, exchange, routing_key, payload, options) do
    sequence_number = AMQP.Confirm.next_publish_seqno(channel)
    message_id = "realtime-retry-#{System.unique_integer([:positive, :monotonic])}"
    options = Keyword.merge(options, persistent: true, mandatory: true, message_id: message_id)

    with :ok <- AMQP.Basic.publish(channel, exchange, routing_key, payload, options) do
      case AMQP.Confirm.wait_for_confirms(channel, {@confirm_timeout_ms, :millisecond}) do
        true -> await_publish_result(sequence_number, message_id)
        false -> {:error, :nacked}
        :timeout -> {:error, :confirm_timeout}
      end
    end
  end

  defp await_publish_result(sequence_number, message_id) do
    receive do
      {:basic_return, _payload, %{message_id: ^message_id}} = result ->
        classify_publish_result(result, sequence_number, message_id)

      {:basic_ack, ^sequence_number, _multiple} = result ->
        classify_publish_result(result, sequence_number, message_id)

      {:basic_nack, ^sequence_number, _multiple} = result ->
        classify_publish_result(result, sequence_number, message_id)
    after
      @confirm_timeout_ms -> {:error, :confirm_timeout}
    end
  end

  @doc false
  def classify_publish_result(
        {:basic_return, _payload, %{message_id: message_id}},
        _sequence,
        message_id
      ),
      do: {:error, :unroutable}

  def classify_publish_result({:basic_ack, sequence, _multiple}, sequence, _message_id), do: :ok

  def classify_publish_result({:basic_nack, sequence, _multiple}, sequence, _message_id),
    do: {:error, :nacked}

  @impl true
  def close(%AMQP.Channel{conn: connection} = channel) do
    if Process.alive?(channel.pid), do: AMQP.Channel.close(channel)
    if Process.alive?(connection.pid), do: AMQP.Connection.close(connection)
    :ok
  catch
    _kind, _reason -> :ok
  end
end
