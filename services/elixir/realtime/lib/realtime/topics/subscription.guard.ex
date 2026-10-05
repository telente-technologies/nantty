defmodule Realtime.Topics.SubscriptionGuard do
  alias Realtime.Topics.TopicAuthorizer

  @default_recheck_interval_ms 60_000

  def recheck_interval_ms,
    do: Application.get_env(:realtime, :subscription_recheck_ms, @default_recheck_interval_ms)

  def revoked_topics(principal, topics) do
    own_topic = "user:#{principal.account_id}"

    topics
    |> Enum.reject(&(&1 == own_topic))
    |> Enum.reject(&(TopicAuthorizer.authorize_subscription(principal, &1) == :ok))
  end

  def membership_revocation(%{
        "type" => type,
        "data" => %{"conversationId" => conversation_id, "accountId" => account_id}
      })
      when type in ["conversation.memberRemoved", "conversation.memberLeft"] and
             is_binary(conversation_id) and is_binary(account_id),
      do: {:ok, "conversation:#{conversation_id}", account_id}

  def membership_revocation(%{
        "type" => "liveViewer.banned",
        "data" => %{"liveId" => live_id, "userId" => user_id}
      })
      when is_binary(live_id) and live_id != "" and is_binary(user_id),
      do: {:ok, "live:#{live_id}", user_id}

  def membership_revocation(_event), do: :ignore
end
