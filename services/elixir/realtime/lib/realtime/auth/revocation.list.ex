defmodule Realtime.Auth.RevocationList do
  @moduledoc false
  alias Realtime.Util.TtlTable

  @table :realtime_revocations
  @topic "realtime:revocations"
  @default_ttl_ms 30 * 60 * 1_000

  def child_spec(_options), do: TtlTable.child_spec(name: @table, subscribe: @topic)

  def revoke_account(account_id), do: record({:account, account_id}, System.os_time(:second))

  def revoke_session(session_id), do: record({:session, session_id}, System.os_time(:second))

  def revoked?(%{account_id: account_id, session_id: session_id} = principal) do
    issued_at = Map.get(principal, :issued_at) || 0

    case {TtlTable.get(@table, {:session, session_id}),
          TtlTable.get(@table, {:account, account_id})} do
      {{:ok, _}, _} -> true
      {_, {:ok, revoked_at}} -> issued_at <= revoked_at
      _ -> false
    end
  end

  defp record(key, value) do
    ttl_ms = Application.get_env(:realtime, :revocation_ttl_ms, @default_ttl_ms)
    TtlTable.put(@table, key, value, ttl_ms)
    TtlTable.broadcast_put(@topic, key, value, ttl_ms)
  end
end
