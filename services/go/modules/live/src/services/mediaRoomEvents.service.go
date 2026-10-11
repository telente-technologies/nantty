package services

import (
	"context"
	"log/slog"
	"time"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/guestslot"
	"zudomart/modules/live/src/generated/ent/livesession"
)

const HostLeftMediaRoomGrace = 20 * time.Second

type MediaRoomEvent struct {
	Kind     string
	Room     string
	Identity string
}

const (
	MediaRoomFinished    = "room_finished"
	MediaParticipantLeft = "participant_left"
)

// Only the heartbeat lease is shortened: a host app that still heartbeats keeps its live, and encoder lives (no lease) are never ended here.
func (service *LiveService) RecordMediaRoomEvent(ctx context.Context, event MediaRoomEvent) error {
	if event.Room == "" || (event.Kind != MediaRoomFinished && event.Kind != MediaParticipantLeft) {
		return nil
	}
	session, err := service.Client.LiveSession.Query().Where(livesession.LivekitRoom(event.Room)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if session.State != livesession.StateLive && session.State != livesession.StateConnecting {
		return nil
	}
	grace := time.Duration(0)
	if event.Kind == MediaParticipantLeft {
		if event.Identity != session.HostID.String() {
			return nil
		}
		grace = HostLeftMediaRoomGrace
	}
	deadline := service.Now().Add(grace)
	shortened, err := service.Client.GuestSlot.Update().Where(guestslot.LiveID(session.ID), guestslot.UserID(session.HostID), guestslot.RoleEQ(guestslot.RoleHost),
		guestslot.StateEQ(guestslot.StateOnStage), guestslot.StateDeadlineAtNotNil(), guestslot.StateDeadlineAtGT(deadline)).SetStateDeadlineAt(deadline).Save(ctx)
	if err == nil && shortened > 0 {
		service.Logger.InfoContext(ctx, "host left the media room; shortening the heartbeat lease", slog.String("liveId", session.ID.String()), slog.String("event", event.Kind))
	}
	return err
}
