defmodule Realtime.Topics.TopicAuthorizer do
  @live_topic_kinds ~w(live battle)

  def authorize_subscription(principal, topic) do
    case String.split(topic, ":", parts: 2) do
      ["user", account_id] when account_id == principal.account_id ->
        :ok

      ["conversation", conversation_id] ->
        authorize_conversation_member(principal, conversation_id)

      [kind, identifier] when kind in @live_topic_kinds and identifier != "" ->
        authorize_live_access(principal, topic)

      _ ->
        {:error, :forbidden}
    end
  end

  def authorize_conversation_delivery(principal, conversation_id)
      when is_map(principal) and is_binary(conversation_id) and conversation_id != "" do
    authorize_subscription(principal, "conversation:#{conversation_id}")
  end

  def authorize_conversation_delivery(_principal, _conversation_id),
    do: {:error, :forbidden}

  defp authorize_live_access(principal, topic) do
    checker =
      Application.get_env(:realtime, :live_access_checker, Realtime.Topics.LiveAccessClient)

    if checker.can_join?(principal.account_id, topic), do: :ok, else: {:error, :forbidden}
  end

  def conversation_member_summary(principal, conversation_id) do
    checker = membership_checker()

    summary =
      if Code.ensure_loaded?(checker) and function_exported?(checker, :member_summary, 2),
        do: checker.member_summary(principal.account_id, conversation_id)

    Map.put(summary || %{}, "id", principal.account_id)
  end

  def forget_conversation_membership(account_id, conversation_id) do
    checker = membership_checker()

    if Code.ensure_loaded?(checker) and function_exported?(checker, :forget, 2),
      do: checker.forget(account_id, conversation_id)

    :ok
  end

  defp authorize_conversation_member(principal, conversation_id) do
    if membership_checker().member?(principal.account_id, conversation_id),
      do: :ok,
      else: {:error, :forbidden}
  end

  defp membership_checker,
    do:
      Application.get_env(
        :realtime,
        :conversation_membership_checker,
        Realtime.Topics.ConversationMembershipClient
      )
end
