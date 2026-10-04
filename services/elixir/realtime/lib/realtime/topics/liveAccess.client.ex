defmodule Realtime.Topics.LiveAccessClient do
  @moduledoc false
  require Logger

  @timeout_ms 2_000

  def can_join?(account_id, topic) do
    settings = Application.get_env(:realtime, :live_internal, [])

    case {settings[:url], settings[:token]} do
      {url, token} when is_binary(url) and url != "" and is_binary(token) and token != "" ->
        ask_live(url, token, account_id, topic)

      _ ->
        Logger.warning("live internal url or token is not configured: live topics are denied")
        false
    end
  end

  defp ask_live(url, token, account_id, topic) do
    query = URI.encode_query(%{"userId" => account_id, "topic" => topic})
    full_url = String.trim_trailing(url, "/") <> "/api/v1/internal/live/topic-access?" <> query

    headers = [
      {~c"x-internal-token", String.to_charlist(token)},
      {~c"accept", ~c"application/json"}
    ]

    case :httpc.request(
           :get,
           {String.to_charlist(full_url), headers},
           [timeout: @timeout_ms, connect_timeout: @timeout_ms],
           body_format: :binary
         ) do
      {:ok, {{_, 200, _}, _headers, body}} -> allowed?(body)
      _ -> false
    end
  end

  defp allowed?(body) do
    case Jason.decode(body) do
      {:ok, %{"allowed" => true}} -> true
      _ -> false
    end
  end
end
