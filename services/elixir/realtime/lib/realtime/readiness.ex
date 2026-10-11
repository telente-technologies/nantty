defmodule Realtime.Readiness do
  @moduledoc false

  @timeout_ms 1_000

  def check(consumer \\ Realtime.Events.AmqpConsumer, broker_enabled? \\ broker_enabled?()) do
    if broker_enabled? and not consumer_connected?(consumer), do: {:error, :rabbitmq}, else: :ok
  end

  defp broker_enabled?,
    do: Keyword.get(Application.get_env(:realtime, :amqp, []), :enabled, false)

  defp consumer_connected?(consumer) do
    GenServer.call(consumer, :connected?, @timeout_ms)
  catch
    :exit, _reason -> false
  end
end
