defmodule Realtime.Events.DomainEventRouter do
  alias Phoenix.PubSub
  alias Realtime.Events.Throttle

  @live_event_names %{
    "gift.sent" => "gift.sent",
    "goal.progressed" => "gift.goal.progress",
    "goal.completed" => "gift.goal.completed",
    "leaderboard.updated" => "leaderboard.updated",
    "live.started" => "live.started",
    "live.ended" => "live.ended",
    "live.topSupporterSelected" => "live.topSupporter",
    "live.viewerCountChanged" => "live.viewerCount",
    "guest.joined" => "guest.joined",
    "guest.left" => "guest.left",
    "guest.removed" => "guest.removed",
    "guest.muted" => "guest.muted",
    "guest.reconnecting" => "guest.reconnecting",
    "stage.updated" => "stage.updated",
    "battle.created" => "battle.created",
    "battle.started" => "battle.started",
    "battle.ended" => "battle.ended",
    "battle.settled" => "battle.settled",
    "battle.cancelled" => "battle.cancelled",
    "battle.scoreUpdated" => "battle.score.updated",
    "battle.winnerCelebrated" => "battle.winner.celebrated",
    "liveComment.deleted" => "live.comment.deleted",
    "liveComment.pinned" => "live.comment.pinned",
    "liveComment.unpinned" => "live.comment.unpinned",
    "liveRoomSettings.updated" => "live.room.settings",
    "overlayScene.published" => "overlay.scene.published",
    "overlayScene.unpublished" => "overlay.scene.unpublished",
    "liveSafety.paused" => "live.safety.paused",
    "liveSafety.resumed" => "live.safety.resumed"
  }

  @private_user_event_names %{
    "liveViewer.muted" => "live.viewer.muted",
    "liveViewer.unmuted" => "live.viewer.unmuted",
    "liveViewer.banned" => "live.viewer.banned",
    "liveViewer.unbanned" => "live.viewer.unbanned"
  }

  @host_recording_event_names %{
    "liveRecording.started" => "live.recording.started",
    "liveRecording.completed" => "live.recording.ready",
    "liveRecording.failed" => "live.recording.failed",
    "liveSafety.hostNotice" => "live.safety.hostNotice"
  }

  def route_domain_event_to_topic(%{
        "type" => "guest.invited",
        "data" => %{"userId" => user_id} = data
      })
      when is_binary(user_id),
      do: {:ok, "user:#{user_id}", Map.put(data, "type", "guest.invited")}

  def route_domain_event_to_topic(%{
        "type" => "liveComment.created",
        "data" => %{"liveId" => live_id, "comment" => %{} = comment}
      })
      when is_binary(live_id) and live_id != "",
      do: {:ok, "live:#{live_id}", Map.put(comment, "type", "live.comment")}

  def route_domain_event_to_topic(%{"type" => type, "data" => %{"userId" => user_id} = data})
      when is_map_key(@private_user_event_names, type) and is_binary(user_id) and user_id != "",
      do:
        {:ok, "user:#{user_id}",
         Map.put(data, "type", Map.fetch!(@private_user_event_names, type))}

  def route_domain_event_to_topic(%{"type" => type, "data" => %{"hostId" => host_id} = data})
      when is_map_key(@host_recording_event_names, type) and is_binary(host_id) and host_id != "",
      do:
        {:ok, "user:#{host_id}",
         Map.put(data, "type", Map.fetch!(@host_recording_event_names, type))}

  def route_domain_event_to_topic(%{"type" => type, "data" => %{"liveId" => live_id} = data})
      when is_map_key(@live_event_names, type) and is_binary(live_id) and live_id != "",
      do: {:ok, "live:#{live_id}", Map.put(data, "type", Map.fetch!(@live_event_names, type))}

  def route_domain_event_to_topic(%{
        "type" => "message.created",
        "data" => %{"conversationId" => conversation_id, "message" => message}
      }),
      do:
        {:ok, "conversation:#{conversation_id}",
         %{"type" => "message.created", "message" => message}}

  def route_domain_event_to_topic(%{
        "type" => "notification.created",
        "data" => %{"accountId" => account_id} = data
      }),
      do: {:ok, "user:#{account_id}", Map.put(data, "type", "notification.created")}

  def route_domain_event_to_topic(_event), do: :ignore

  def throttle_specification_for_event(%{
        "type" => "goal.progressed",
        "data" => %{"goalId" => id}
      }),
      do: {{:goal_progress, id}, 1_000}

  def throttle_specification_for_event(%{
        "type" => "leaderboard.updated",
        "data" => %{"liveId" => live_id, "scope" => scope}
      }),
      do: {{:leaderboard, live_id, scope}, 1_000}

  def throttle_specification_for_event(%{
        "type" => "live.viewerCountChanged",
        "data" => %{"liveId" => live_id}
      }),
      do: {{:viewer_count, live_id}, 2_000}

  def throttle_specification_for_event(%{
        "type" => "battle.scoreUpdated",
        "data" => %{"battleId" => battle_id}
      }),
      do: {{:battle_score, battle_id}, 500}

  def throttle_specification_for_event(_event), do: nil

  def broadcast_domain_event(event, throttle \\ Throttle) do
    case route_domain_event_to_topic(event) do
      {:ok, topic, payload} -> broadcast_possibly_throttled(event, topic, payload, throttle)
      :ignore -> :ok
    end
  end

  defp broadcast_possibly_throttled(event, topic, payload, throttle) do
    deliver = fn ->
      PubSub.broadcast(Realtime.PubSub, topic, {:realtime_event, topic, payload})
    end

    case throttle_specification_for_event(event) do
      nil -> deliver.()
      {key, interval_ms} -> Throttle.submit(throttle, key, interval_ms, deliver)
    end
  end
end
