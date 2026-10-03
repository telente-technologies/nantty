defmodule Realtime.Events.QueueClient do
  @type message :: %{body: String.t(), receipt_handle: String.t()}

  @callback resolve_queue_url(queue_name :: String.t()) :: {:ok, String.t()} | {:error, term()}
  @callback receive_messages(queue_url :: String.t()) :: {:ok, [message()]} | {:error, term()}
  @callback delete_message(queue_url :: String.t(), receipt_handle :: String.t()) ::
              :ok | {:error, term()}
end
