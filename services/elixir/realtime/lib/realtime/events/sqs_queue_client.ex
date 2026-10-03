defmodule Realtime.Events.SqsQueueClient do
  @behaviour Realtime.Events.QueueClient

  alias Realtime.Events.AwsSignatureV4

  @long_poll_seconds 20
  @request_timeout_ms 30_000

  @impl true
  def resolve_queue_url(queue_name) do
    with {:ok, %{"QueueUrl" => url}} <- call("GetQueueUrl", %{"QueueName" => queue_name}),
         do: {:ok, url}
  end

  @impl true
  def receive_messages(queue_url) do
    request = %{
      "QueueUrl" => queue_url,
      "MaxNumberOfMessages" => 10,
      "WaitTimeSeconds" => @long_poll_seconds
    }

    with {:ok, response} <- call("ReceiveMessage", request) do
      {:ok,
       for(
         %{"Body" => body, "ReceiptHandle" => handle} <- Map.get(response, "Messages", []),
         do: %{body: body, receipt_handle: handle}
       )}
    end
  end

  @impl true
  def delete_message(queue_url, receipt_handle) do
    with {:ok, _} <-
           call("DeleteMessage", %{"QueueUrl" => queue_url, "ReceiptHandle" => receipt_handle}),
         do: :ok
  end

  defp call(action, request) do
    settings = Application.fetch_env!(:realtime, :sqs)
    endpoint = URI.parse(settings[:endpoint])
    body = Jason.encode!(request)
    host_header = host_header_for(endpoint)

    headers =
      AwsSignatureV4.sign_post_request(%{
        host_header: host_header,
        region: settings[:region],
        service: "sqs",
        access_key_id: settings[:access_key_id],
        secret_access_key: settings[:secret_access_key],
        target: "AmazonSQS.#{action}",
        body: body,
        now: DateTime.utc_now()
      })
      |> Enum.map(fn {name, value} -> {String.to_charlist(name), String.to_charlist(value)} end)

    http_request =
      {String.to_charlist(settings[:endpoint]), headers, ~c"application/x-amz-json-1.0", body}

    case :httpc.request(:post, http_request, [timeout: @request_timeout_ms], body_format: :binary) do
      {:ok, {{_, 200, _}, _headers, response_body}} ->
        Jason.decode(response_body)

      {:ok, {{_, status, _}, _headers, response_body}} ->
        {:error, {:sqs_status, status, response_body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp host_header_for(%URI{host: host, port: port, scheme: scheme}) do
    default_port = if scheme == "https", do: 443, else: 80
    if port in [nil, default_port], do: host, else: "#{host}:#{port}"
  end
end
