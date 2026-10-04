defmodule Realtime.Events.DomainEventRouterTest do
  use ExUnit.Case, async: true
  alias Realtime.Events.DomainEventRouter

  @live_rows [
    {"gift.sent", "gift.sent"},
    {"goal.progressed", "gift.goal.progress"},
    {"goal.completed", "gift.goal.completed"},
    {"leaderboard.updated", "leaderboard.updated"},
    {"live.started", "live.started"},
    {"live.ended", "live.ended"},
    {"live.topSupporterSelected", "live.topSupporter"},
    {"live.viewerCountChanged", "live.viewerCount"},
    {"guest.joined", "guest.joined"},
    {"guest.left", "guest.left"},
    {"guest.removed", "guest.removed"},
    {"guest.muted", "guest.muted"},
    {"guest.reconnecting", "guest.reconnecting"},
    {"stage.updated", "stage.updated"},
    {"battle.created", "battle.created"},
    {"battle.started", "battle.started"},
    {"battle.ended", "battle.ended"},
    {"battle.settled", "battle.settled"},
    {"battle.cancelled", "battle.cancelled"},
    {"battle.scoreUpdated", "battle.score.updated"},
    {"battle.winnerCelebrated", "battle.winner.celebrated"},
    {"liveComment.deleted", "live.comment.deleted"},
    {"liveComment.pinned", "live.comment.pinned"},
    {"liveComment.unpinned", "live.comment.unpinned"},
    {"liveRoomSettings.updated", "live.room.settings"},
    {"overlayScene.published", "overlay.scene.published"},
    {"overlayScene.unpublished", "overlay.scene.unpublished"}
  ]

  for {domain_type, client_type} <- @live_rows do
    test "routes #{domain_type} to the live topic as #{client_type}" do
      assert {:ok, "live:l-1", payload} =
               DomainEventRouter.route_domain_event_to_topic(%{
                 "type" => unquote(domain_type),
                 "data" => %{"liveId" => "l-1", "giftId" => "rose"}
               })

      assert payload == %{
               "type" => unquote(client_type),
               "liveId" => "l-1",
               "giftId" => "rose"
             }
    end
  end

  test "routes guest invitations to the private user topic" do
    assert {:ok, "user:u-7", %{"type" => "guest.invited", "slotId" => "s-1"}} =
             DomainEventRouter.route_domain_event_to_topic(%{
               "type" => "guest.invited",
               "data" => %{"liveId" => "l-1", "userId" => "u-7", "slotId" => "s-1"}
             })
  end

  test "ignores retired names, live events without a live id and unrelated events" do
    for type <- ["live.gift.sent", "live.guestStageChanged", "account.registered"] do
      assert DomainEventRouter.route_domain_event_to_topic(%{
               "type" => type,
               "data" => %{"liveId" => "l-1"}
             }) == :ignore
    end

    assert DomainEventRouter.route_domain_event_to_topic(%{
             "type" => "gift.sent",
             "data" => %{}
           }) == :ignore
  end

  test "keeps message and notification routes" do
    assert {:ok, "conversation:c-1", %{"type" => "message.created"}} =
             DomainEventRouter.route_domain_event_to_topic(%{
               "type" => "message.created",
               "data" => %{"conversationId" => "c-1", "message" => %{}}
             })
  end

  test "declares throttle windows only for the throttled events" do
    assert {{:goal_progress, "g"}, 1_000} =
             DomainEventRouter.throttle_specification_for_event(%{
               "type" => "goal.progressed",
               "data" => %{"goalId" => "g", "liveId" => "l"}
             })

    assert {{:leaderboard, "l", "live"}, 1_000} =
             DomainEventRouter.throttle_specification_for_event(%{
               "type" => "leaderboard.updated",
               "data" => %{"liveId" => "l", "scope" => "live"}
             })

    assert {{:viewer_count, "l"}, 2_000} =
             DomainEventRouter.throttle_specification_for_event(%{
               "type" => "live.viewerCountChanged",
               "data" => %{"liveId" => "l"}
             })

    assert {{:battle_score, "b"}, 500} =
             DomainEventRouter.throttle_specification_for_event(%{
               "type" => "battle.scoreUpdated",
               "data" => %{"battleId" => "b", "liveId" => "l"}
             })

    assert DomainEventRouter.throttle_specification_for_event(%{
             "type" => "gift.sent",
             "data" => %{"liveId" => "l"}
           }) == nil
  end

  test "broadcasts routed events to subscribers" do
    Phoenix.PubSub.subscribe(Realtime.PubSub, "user:a-1")

    DomainEventRouter.broadcast_domain_event(%{
      "type" => "notification.created",
      "data" => %{"accountId" => "a-1", "title" => "hi"}
    })

    assert_receive {:realtime_event, "user:a-1",
                    %{"type" => "notification.created", "title" => "hi"}}
  end

  test "routes a live comment to the live topic with the comment fields the clients render" do
    comment = %{
      "id" => "c-1",
      "liveId" => "l-1",
      "author" => %{"id" => "u-1"},
      "text" => "hi",
      "kind" => "comment"
    }

    assert {:ok, "live:l-1", payload} =
             DomainEventRouter.route_domain_event_to_topic(%{
               "type" => "liveComment.created",
               "data" => %{"liveId" => "l-1", "comment" => comment, "mentionedUserIds" => []}
             })

    assert payload == Map.put(comment, "type", "live.comment")
  end

  test "sends mute and ban notices only to the affected viewer" do
    for {domain, client} <- [
          {"liveViewer.muted", "live.viewer.muted"},
          {"liveViewer.unmuted", "live.viewer.unmuted"},
          {"liveViewer.banned", "live.viewer.banned"},
          {"liveViewer.unbanned", "live.viewer.unbanned"}
        ] do
      assert {:ok, "user:u-9", %{"type" => ^client, "liveId" => "l-1"}} =
               DomainEventRouter.route_domain_event_to_topic(%{
                 "type" => domain,
                 "data" => %{"liveId" => "l-1", "userId" => "u-9", "actorId" => "u-2"}
               })
    end
  end

  test "tells only the host when a recording starts, is ready or fails" do
    for {domain, client} <- [
          {"liveRecording.started", "live.recording.started"},
          {"liveRecording.completed", "live.recording.ready"},
          {"liveRecording.failed", "live.recording.failed"}
        ] do
      assert {:ok, "user:host-1", %{"type" => ^client, "recordingId" => "r-1"}} =
               DomainEventRouter.route_domain_event_to_topic(%{
                 "type" => domain,
                 "data" => %{"liveId" => "l-1", "hostId" => "host-1", "recordingId" => "r-1"}
               })
    end
  end

  test "pauses and resumes a live for every viewer without the reason" do
    for {domain, client, state} <- [
          {"liveSafety.paused", "live.safety.paused", "paused"},
          {"liveSafety.resumed", "live.safety.resumed", "live"}
        ] do
      assert {:ok, "live:l-1", %{"type" => ^client, "state" => ^state} = payload} =
               DomainEventRouter.route_domain_event_to_topic(%{
                 "type" => domain,
                 "data" => %{"liveId" => "l-1", "state" => state, "message" => "", "at" => "t"}
               })

      refute Map.has_key?(payload, "category")
    end
  end

  test "tells only the host why their live was paused" do
    assert {:ok, "user:host-1", %{"type" => "live.safety.hostNotice", "kind" => "hold"}} =
             DomainEventRouter.route_domain_event_to_topic(%{
               "type" => "liveSafety.hostNotice",
               "data" => %{"liveId" => "l-1", "hostId" => "host-1", "kind" => "hold", "message" => "m"}
             })
  end
end
