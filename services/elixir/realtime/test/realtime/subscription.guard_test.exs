defmodule Realtime.Topics.SubscriptionGuardTest do
  use ExUnit.Case, async: false

  alias Phoenix.PubSub
  alias Realtime.Events.DomainEventRouter
  alias Realtime.Topics.SubscriptionGuard
  alias RealtimeWeb.ClientSocket

  @principal %{account_id: "account-1", session_id: "session-1", roles: []}

  defmodule Membership do
    def member?(account_id, conversation_id) do
      Agent.get(__MODULE__, &MapSet.member?(&1, {account_id, conversation_id}))
    end
  end

  setup do
    start_supervised!(%{
      id: Membership,
      start:
        {Agent, :start_link, [fn -> MapSet.new([{"account-1", "c-1"}]) end, [name: Membership]]}
    })

    previous = Application.get_env(:realtime, :conversation_membership_checker)
    Application.put_env(:realtime, :conversation_membership_checker, Membership)
    Application.put_env(:realtime, :subscription_recheck_ms, 10)

    on_exit(fn ->
      Application.delete_env(:realtime, :subscription_recheck_ms)
      restore(previous)
    end)

    :ok
  end

  defp restore(nil), do: Application.delete_env(:realtime, :conversation_membership_checker)
  defp restore(value), do: Application.put_env(:realtime, :conversation_membership_checker, value)

  defp remove_member(account_id, conversation_id),
    do: Agent.update(Membership, &MapSet.delete(&1, {account_id, conversation_id}))

  defp joined_state do
    PubSub.subscribe(Realtime.PubSub, "conversation:c-1")
    %{principal: @principal, topics: MapSet.new(["user:account-1", "conversation:c-1"])}
  end

  test "keeps the own user topic and topics the member still belongs to" do
    assert SubscriptionGuard.revoked_topics(@principal, ["user:account-1", "conversation:c-1"]) ==
             []
  end

  test "the periodic recheck kicks a removed member off the conversation" do
    state = joined_state()
    remove_member("account-1", "c-1")

    assert {:push, {:text, frame}, next} = ClientSocket.handle_info(:recheck_subscriptions, state)

    assert %{"type" => "subscriptions.revoked", "topics" => ["conversation:c-1"]} =
             Jason.decode!(frame)

    assert next.topics == MapSet.new(["user:account-1"])
    assert_receive :recheck_subscriptions, 1_000
  end

  test "a membership-change event rechecks only the affected account" do
    state = joined_state()

    assert {:ok, ^state} =
             ClientSocket.handle_info(
               {:membership_changed, "conversation:c-1", "account-2"},
               state
             )

    assert {:ok, ^state} =
             ClientSocket.handle_info(
               {:membership_changed, "conversation:c-1", "account-1"},
               state
             )

    remove_member("account-1", "c-1")

    assert {:push, {:text, _frame}, next} =
             ClientSocket.handle_info(
               {:membership_changed, "conversation:c-1", "account-1"},
               state
             )

    refute MapSet.member?(next.topics, "conversation:c-1")
  end

  test "member removal and live bans are broadcast to the affected topic" do
    PubSub.subscribe(Realtime.PubSub, "conversation:c-9")
    PubSub.subscribe(Realtime.PubSub, "live:l-1")

    DomainEventRouter.broadcast_domain_event(%{
      "type" => "conversation.memberRemoved",
      "data" => %{"conversationId" => "c-9", "accountId" => "account-1"}
    })

    DomainEventRouter.broadcast_domain_event(%{
      "type" => "liveViewer.banned",
      "data" => %{"liveId" => "l-1", "userId" => "account-1"}
    })

    assert_receive {:membership_changed, "conversation:c-9", "account-1"}
    assert_receive {:membership_changed, "live:l-1", "account-1"}
    assert SubscriptionGuard.membership_revocation(%{"type" => "message.created"}) == :ignore
  end
end
