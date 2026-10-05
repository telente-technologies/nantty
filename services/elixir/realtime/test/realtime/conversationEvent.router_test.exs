defmodule Realtime.Events.ConversationEventRouterTest do
  use ExUnit.Case, async: false
  alias Phoenix.PubSub
  alias Realtime.Events.{ConversationEventRouter, DomainEventRouter}

  test "routes message and conversation events to the conversation topic with client types" do
    for {domain, client} <- [
          {"message.updated", "message.updated"},
          {"message.removed", "message.removed"},
          {"message.reactionsChanged", "reaction"},
          {"conversation.read", "read"},
          {"conversation.updated", "conversation.updated"}
        ] do
      assert {:ok, "conversation:c-1", payload} =
               DomainEventRouter.route_domain_event_to_topic(%{
                 "type" => domain,
                 "data" => %{
                   "conversationId" => "c-1",
                   "messageId" => "m-1",
                   "memberIds" => ["a"]
                 }
               })

      assert payload["type"] == client
      assert payload["messageId"] == "m-1"
      refute Map.has_key?(payload, "memberIds")
    end
  end

  test "keeps the message.created shape and adds the conversation id" do
    assert {:ok, "conversation:c-1",
            %{"type" => "message.created", "conversationId" => "c-1", "message" => %{"id" => "m"}}} =
             ConversationEventRouter.route(%{
               "type" => "message.created",
               "data" => %{"conversationId" => "c-1", "message" => %{"id" => "m"}}
             })
  end

  test "sends a per-member conversation update only to that member" do
    assert {:ok, "user:a-1", %{"type" => "conversation.updated", "conversation" => %{}}} =
             ConversationEventRouter.route(%{
               "type" => "conversation.updated",
               "data" => %{"accountId" => "a-1", "conversation" => %{}}
             })

    assert ConversationEventRouter.fanout_account_ids(%{
             "type" => "conversation.updated",
             "data" => %{"accountId" => "a-1", "conversation" => %{}}
           }) == []
  end

  test "fans out to recipients and the sender once each" do
    assert ConversationEventRouter.fanout_account_ids(%{
             "type" => "message.created",
             "data" => %{
               "conversationId" => "c-1",
               "recipientIds" => ["r-1", "r-2", "r-1"],
               "message" => %{"senderId" => "s-1"}
             }
           }) == ["r-1", "r-2", "s-1"]
  end

  test "broadcasts to the conversation topic and fans out to member user topics" do
    PubSub.subscribe(Realtime.PubSub, "conversation:c-9")
    PubSub.subscribe(Realtime.PubSub, "user:r-9")

    DomainEventRouter.broadcast_domain_event(%{
      "type" => "message.created",
      "data" => %{
        "conversationId" => "c-9",
        "recipientIds" => ["r-9"],
        "message" => %{"id" => "m-9", "senderId" => "s-9"}
      }
    })

    assert_receive {:realtime_event, "conversation:c-9", %{"type" => "message.created"}}
    assert_receive {:conversation_fanout, "c-9", %{"type" => "message.created"}}
  end

  test "personalizes reactions for the viewer and hides who reacted" do
    payload = %{
      "type" => "reaction",
      "reactions" => [%{"emoji" => "x", "count" => 2, "accountIds" => ["a-1", "a-2"]}]
    }

    assert %{"reactions" => [%{"emoji" => "x", "count" => 2, "reactedByMe" => true} = mine]} =
             ConversationEventRouter.personalize(payload, "a-1")

    refute Map.has_key?(mine, "accountIds")

    assert %{"reactions" => [%{"reactedByMe" => false}]} =
             ConversationEventRouter.personalize(payload, "a-3")
  end

  test "ignores conversation events without a conversation id" do
    assert ConversationEventRouter.route(%{"type" => "message.removed", "data" => %{}}) == :ignore
  end
end
