defmodule Realtime.Topics.ConversationMembershipClient do
  @moduledoc false
  require Logger
  alias Realtime.Util.TtlTable

  @table :realtime_conversation_membership
  @timeout_ms 2_000
  @member_ttl_ms 30_000
  @non_member_ttl_ms 5_000
  @identifier ~r/\A[A-Za-z0-9_-]{1,64}\z/

  def table, do: @table

  def member?(account_id, conversation_id),
    do: match?({:member, _summary}, lookup(account_id, conversation_id))

  def member_summary(account_id, conversation_id) do
    case lookup(account_id, conversation_id) do
      {:member, summary} -> summary
      _ -> nil
    end
  end

  def forget(account_id, conversation_id),
    do: TtlTable.delete(@table, {account_id, conversation_id})

  defp lookup(account_id, conversation_id) do
    with true <- valid_identifier?(account_id) and valid_identifier?(conversation_id),
         :miss <- TtlTable.get(@table, {account_id, conversation_id}) do
      fetch_and_cache(account_id, conversation_id)
    else
      {:ok, cached} -> cached
      false -> :not_member
    end
  end

  defp fetch_and_cache(account_id, conversation_id) do
    case ask_social(account_id, conversation_id) do
      {:member, _summary} = result ->
        TtlTable.put(@table, {account_id, conversation_id}, result, ttl(:member_ttl_ms))
        result

      :not_member ->
        TtlTable.put(@table, {account_id, conversation_id}, :not_member, ttl(:non_member_ttl_ms))
        :not_member

      :unavailable ->
        :unavailable
    end
  end

  defp ask_social(account_id, conversation_id) do
    settings = Application.get_env(:realtime, :social_internal, [])

    case {settings[:url], settings[:token]} do
      {url, token} when is_binary(url) and url != "" and is_binary(token) and token != "" ->
        request(url, token, account_id, conversation_id)

      _ ->
        Logger.warning("social internal url or token is not configured: conversations are denied")
        :unavailable
    end
  end

  defp request(url, token, account_id, conversation_id) do
    full_url =
      String.trim_trailing(url, "/") <>
        "/api/v1/internal/conversations/#{conversation_id}/members/#{account_id}"

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
      {:ok, {{_, 200, _}, _headers, body}} -> decode(body, account_id)
      {:ok, {{_, status, _}, _headers, _body}} when status in [403, 404] -> :not_member
      _ -> :unavailable
    end
  end

  defp decode(body, account_id) do
    case Jason.decode(body) do
      {:ok, %{"member" => true} = response} -> {:member, summary(response["user"], account_id)}
      {:ok, %{"member" => false}} -> :not_member
      _ -> :unavailable
    end
  end

  defp summary(%{} = user, account_id) do
    user
    |> Map.take(["name", "username", "avatarUrl", "verified"])
    |> Map.put("id", account_id)
  end

  defp summary(_user, account_id), do: %{"id" => account_id}

  defp valid_identifier?(value), do: is_binary(value) and Regex.match?(@identifier, value)

  defp ttl(key) do
    defaults = %{member_ttl_ms: @member_ttl_ms, non_member_ttl_ms: @non_member_ttl_ms}

    Keyword.get(
      Application.get_env(:realtime, :conversation_membership_cache, []),
      key,
      defaults[key]
    )
  end
end
