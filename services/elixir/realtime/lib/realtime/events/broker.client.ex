defmodule Realtime.Events.BrokerClient do
  @type channel :: term()

  @callback open(settings :: keyword()) :: {:ok, channel()} | {:error, term()}
  @callback channel_process(channel()) :: pid()
  @callback consume(channel(), queue :: String.t(), prefetch :: pos_integer()) ::
              {:ok, String.t()} | {:error, term()}
  @callback ack(channel(), delivery_tag :: non_neg_integer()) :: :ok | {:error, term()}
  @callback reject(channel(), delivery_tag :: non_neg_integer(), requeue :: boolean()) ::
              :ok | {:error, term()}
  @callback publish_confirmed(
              channel(),
              exchange :: String.t(),
              routing_key :: String.t(),
              payload :: binary(),
              options :: keyword()
            ) :: :ok | {:error, term()}
  @callback close(channel()) :: :ok
end
