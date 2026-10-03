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
    options = Keyword.merge(options, persistent: true, mandatory: true)

    with :ok <- AMQP.Basic.publish(channel, exchange, routing_key, payload, options) do
      case AMQP.Confirm.wait_for_confirms(channel, {@confirm_timeout_ms, :millisecond}) do
        true -> :ok
        false -> {:error, :nacked}
        :timeout -> {:error, :confirm_timeout}
      end
    end
  end

  @impl true
  def close(%AMQP.Channel{conn: connection} = channel) do
    if Process.alive?(channel.pid), do: AMQP.Channel.close(channel)
    if Process.alive?(connection.pid), do: AMQP.Connection.close(connection)
    :ok
  catch
    _kind, _reason -> :ok
  end
end
