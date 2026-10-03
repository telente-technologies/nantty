defmodule Realtime.Presence.LivePresenceClient do
  @moduledoc false
  require Logger

  @timeout_ms 3_000

  def send_presence_change(live_id, joined, left) do
    settings = Application.get_env(:realtime, :live_internal, [])

    case {settings[:url], settings[:token]} do
      {url, token} when is_binary(url) and url != "" and is_binary(token) and token != "" ->
        post(url, token, live_id, joined, left)

      _ ->
        :skipped
    end
  end

  defp post(url, token, live_id, joined, left) do
    full_url = String.trim_trailing(url, "/") <> "/api/v1/internal/live/#{URI.encode(live_id)}/presence"
    body = Jason.encode!(%{"joined" => joined, "left" => left})
    headers = [{~c"x-internal-token", String.to_charlist(token)}]

    case :httpc.request(:post, {String.to_charlist(full_url), headers, ~c"application/json", body}, [timeout: @timeout_ms, connect_timeout: @timeout_ms], []) do
      {:ok, {{_, status, _}, _, _}} when status in 200..299 -> :ok
      {:ok, {{_, status, _}, _, _}} -> Logger.warning("live presence forward rejected with status #{status}")
      {:error, reason} -> Logger.warning("live presence forward failed: #{inspect(reason)}")
    end
  end
end
