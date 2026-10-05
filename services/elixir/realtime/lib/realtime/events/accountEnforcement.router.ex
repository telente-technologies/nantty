defmodule Realtime.Events.AccountEnforcementRouter do
  @moduledoc false
  alias Phoenix.PubSub
  alias Realtime.Auth.RevocationList

  @account_events ~w(account.suspended account.banned)
  @session_events ~w(session.revoked session.refreshTokenReuseDetected)

  def enforce(event) do
    case decide(event) do
      {:account, account_id, reason} ->
        RevocationList.revoke_account(account_id)
        disconnect(account_id, :all, reason)

      {:all_sessions, account_id, reason} ->
        disconnect(account_id, :all, reason)

      {:session, account_id, session_id, reason} ->
        RevocationList.revoke_session(session_id)
        disconnect(account_id, {:session, session_id}, reason)

      :ignore ->
        :ok
    end
  end

  def decide(%{"type" => type, "data" => %{"accountId" => account_id}})
      when type in @account_events and is_binary(account_id) and account_id != "",
      do: {:account, account_id, type}

  def decide(%{"type" => type, "data" => %{"accountId" => account_id, "sessionId" => "*"}})
      when type in @session_events and is_binary(account_id) and account_id != "",
      do: {:all_sessions, account_id, type}

  def decide(%{"type" => type, "data" => %{"accountId" => account_id, "sessionId" => session_id}})
      when type in @session_events and is_binary(account_id) and account_id != "" and
             is_binary(session_id) and session_id != "",
      do: {:session, account_id, session_id, type}

  def decide(_event), do: :ignore

  defp disconnect(account_id, scope, reason) do
    topic = "user:#{account_id}"
    PubSub.broadcast(Realtime.PubSub, topic, {:disconnect, scope, reason})
  end
end
