package services

import (
	"context"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livecomment"
	"nantty/modules/live/src/types"
)

func (service *LiveService) findLiveComment(ctx context.Context, tx *ent.Tx, liveId, commentId uuid.UUID) (*ent.LiveComment, error) {
	row, err := tx.LiveComment.Query().Where(livecomment.ID(commentId), livecomment.LiveID(liveId), livecomment.DeletedAtIsNil()).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, liveerrors.CommentNotFound
	}
	return row, err
}

func (service *LiveService) DeleteLiveComment(ctx context.Context, actor types.Actor, liveId, commentId uuid.UUID) error {
	session, role, err := service.loadLiveForStaff(ctx, actor, liveId)
	if err != nil {
		return err
	}
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := service.findLiveComment(ctx, tx, liveId, commentId)
		if err != nil {
			return err
		}
		if row.AuthorID != actor.UserId && role == RoleViewer && !actor.HasRole("admin") {
			return liveerrors.NotLiveModerator
		}
		now := service.Now()
		if err := row.Update().SetDeletedAt(now).SetDeletedBy(actor.UserId).Exec(ctx); err != nil {
			return err
		}
		settings, err := ensureRoomSettingsRow(ctx, tx, session.ID)
		if err != nil {
			return err
		}
		if settings.PinnedCommentID != nil && *settings.PinnedCommentID == commentId {
			if err := settings.Update().ClearPinnedCommentID().Exec(ctx); err != nil {
				return err
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveCommentDeleted, liveId.String(), now, events.LiveCommentChangedEventData{
			LiveId: liveId.String(), CommentId: commentId.String(), ActorId: actor.UserId.String(),
		})
	})
}

func (service *LiveService) PinLiveComment(ctx context.Context, actor types.Actor, liveId, commentId uuid.UUID) (types.LiveCommentView, error) {
	if _, _, err := service.requireStaffRole(ctx, actor, liveId); err != nil {
		return types.LiveCommentView{}, err
	}
	var pinned types.LiveCommentView
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := service.findLiveComment(ctx, tx, liveId, commentId)
		if err != nil {
			return err
		}
		settings, err := ensureRoomSettingsRow(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if err := settings.Update().SetPinnedCommentID(commentId).Exec(ctx); err != nil {
			return err
		}
		if pinned, err = service.presentComment(ctx, row, &commentId); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveCommentPinned, liveId.String(), service.Now(), events.LiveCommentChangedEventData{
			LiveId: liveId.String(), CommentId: commentId.String(), ActorId: actor.UserId.String(),
		})
	})
	return pinned, err
}

func (service *LiveService) UnpinLiveComment(ctx context.Context, actor types.Actor, liveId uuid.UUID) error {
	if _, _, err := service.requireStaffRole(ctx, actor, liveId); err != nil {
		return err
	}
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		settings, err := ensureRoomSettingsRow(ctx, tx, liveId)
		if err != nil || settings.PinnedCommentID == nil {
			return err
		}
		commentId := *settings.PinnedCommentID
		if err := settings.Update().ClearPinnedCommentID().Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveCommentUnpinned, liveId.String(), service.Now(), events.LiveCommentChangedEventData{
			LiveId: liveId.String(), CommentId: commentId.String(), ActorId: actor.UserId.String(),
		})
	})
}
