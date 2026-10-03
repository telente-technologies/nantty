package services

import (
	"context"

	"github.com/google/uuid"

	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/types"
)

type roomSettings struct {
	CommentsEnabled bool
	SlowModeSeconds int
	BlockedWords    []string
	PinnedCommentId *uuid.UUID
	RecordEnabled   bool
}

func settingsFromRow(row *ent.LiveRoomSetting) roomSettings {
	return roomSettings{
		CommentsEnabled: row.CommentsEnabled, SlowModeSeconds: row.SlowModeSeconds, BlockedWords: row.BlockedWords,
		PinnedCommentId: row.PinnedCommentID, RecordEnabled: row.RecordEnabled,
	}
}

func (service *LiveService) loadRoomSettings(ctx context.Context, liveId uuid.UUID) (roomSettings, error) {
	row, err := service.Client.LiveRoomSetting.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return roomSettings{CommentsEnabled: true}, nil
	}
	if err != nil {
		return roomSettings{}, err
	}
	return settingsFromRow(row), nil
}

func ensureRoomSettingsRow(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) (*ent.LiveRoomSetting, error) {
	row, err := tx.LiveRoomSetting.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return tx.LiveRoomSetting.Create().SetID(liveId).Save(ctx)
	}
	return row, err
}

func (service *LiveService) loadLiveForStaff(ctx context.Context, actor types.Actor, liveId uuid.UUID) (*ent.LiveSession, string, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return nil, "", liveerrors.LiveNotFound
	}
	if err != nil {
		return nil, "", err
	}
	role, err := service.roleInLive(ctx, session, actor.UserId)
	return session, role, err
}

func (service *LiveService) GetRoomSettings(ctx context.Context, actor types.Actor, liveId uuid.UUID) (types.RoomSettingsView, error) {
	session, role, err := service.loadLiveForStaff(ctx, actor, liveId)
	if err != nil {
		return types.RoomSettingsView{}, err
	}
	decision, err := service.DecideLiveAccess(ctx, session, actor.UserId)
	if err != nil {
		return types.RoomSettingsView{}, err
	}
	if !decision.Allowed {
		return types.RoomSettingsView{}, liveerrors.LiveNotAccessible
	}
	settings, err := service.loadRoomSettings(ctx, liveId)
	if err != nil {
		return types.RoomSettingsView{}, err
	}
	return service.presentRoomSettings(ctx, session, settings, role, actor.UserId)
}

func (service *LiveService) UpdateRoomSettings(ctx context.Context, actor types.Actor, liveId uuid.UUID, input types.RoomSettingsInput) (types.RoomSettingsView, error) {
	var blockedWords []string
	if input.BlockedWords != nil {
		cleaned, err := NormaliseBlockedWords(*input.BlockedWords)
		if err != nil {
			return types.RoomSettingsView{}, err
		}
		blockedWords = cleaned
	}
	var session *ent.LiveSession
	var updated *ent.LiveRoomSetting
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if locked.HostID != actor.UserId {
			return liveerrors.NotLiveHost
		}
		session = locked
		row, err := ensureRoomSettingsRow(ctx, tx, liveId)
		if err != nil {
			return err
		}
		update := row.Update()
		if input.CommentsEnabled != nil {
			update.SetCommentsEnabled(*input.CommentsEnabled)
		}
		if input.SlowModeSeconds != nil {
			update.SetSlowModeSeconds(*input.SlowModeSeconds)
		}
		if input.BlockedWords != nil {
			update.SetBlockedWords(blockedWords)
		}
		if updated, err = update.Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveRoomSettingsSet, liveId.String(), service.Now(), events.LiveRoomSettingsEventData{
			LiveId: liveId.String(), CommentsEnabled: updated.CommentsEnabled, SlowModeSeconds: updated.SlowModeSeconds,
		})
	})
	if err != nil {
		return types.RoomSettingsView{}, err
	}
	return service.presentRoomSettings(ctx, session, settingsFromRow(updated), RoleHost, actor.UserId)
}

func (service *LiveService) presentRoomSettings(ctx context.Context, session *ent.LiveSession, settings roomSettings, role string, viewerId uuid.UUID) (types.RoomSettingsView, error) {
	view := types.RoomSettingsView{
		LiveId: session.ID.String(), CommentsEnabled: settings.CommentsEnabled, SlowModeSeconds: settings.SlowModeSeconds, MyRole: role,
	}
	if role != RoleViewer {
		view.BlockedWords = append([]string{}, settings.BlockedWords...)
	}
	if role == RoleHost {
		recording := settings.RecordEnabled
		view.RecordEnabled = &recording
	}
	if settings.PinnedCommentId != nil {
		pinned, err := service.loadCommentView(ctx, session.ID, *settings.PinnedCommentId, settings.PinnedCommentId)
		if err != nil {
			return types.RoomSettingsView{}, err
		}
		view.PinnedComment = pinned
	}
	if role == RoleViewer {
		if muted, err := service.activeMute(ctx, session.ID, viewerId); err == nil && muted != nil {
			view.MutedUntil = expiryOrNil(muted.ExpiresAt)
			if view.MutedUntil == nil {
				forever := "indefinite"
				view.MutedUntil = &forever
			}
		}
	}
	return view, nil
}
