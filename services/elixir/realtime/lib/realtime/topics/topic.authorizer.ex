defmodule Realtime.Topics.TopicAuthorizer do
  @public_topic_kinds ~w(live battle)

  def authorize_subscription(principal, topic) do
    case String.split(topic, ":", parts: 2) do
      ["user", account_id] when account_id == principal.account_id ->
        :ok

      ["conversation", conversation_id] ->
        authorize_conversation_member(principal, conversation_id)

      [kind, identifier] when kind in @public_topic_kinds and identifier != "" ->
        :ok

      _ ->
        {:error, :forbidden}
    end
  end

  defp authorize_conversation_member(principal, conversation_id) do
    membership_checker =
      Application.get_env(
        :realtime,
        :conversation_membership_checker,
        Realtime.Topics.DenyAllConversationMembership
      )

    if membership_checker.member?(principal.account_id, conversation_id),
      do: :ok,
      else: {:error, :forbidden}
  end
end

defmodule Realtime.Topics.DenyAllConversationMembership do
  def member?(_account_id, _conversation_id), do: false
end
