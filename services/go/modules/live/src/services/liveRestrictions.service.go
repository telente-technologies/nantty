package services

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/liverestriction"
	"nantty/modules/live/src/generated/ent/liveviewer"
	"nantty/modules/live/src/types"
)

type RestrictionInput struct {
	Kind            liverestriction.Kind
	DurationMinutes int
	Reason          string
}

func (service *LiveService) ImposeRestriction(ctx context.Context, actor types.Actor, liveId, targetId uuid.UUID, input RestrictionInput) (types.RestrictionView, error) {
	session, role, err := service.requireStaffRole(ctx, actor, liveId)
	if err != nil {
		return types.RestrictionView{}, err
	}
	if targetId == actor.UserId || targetId == session.HostID {
		return types.RestrictionView{}, liveerrors.CannotRestrictHost
	}
	if role != RoleHost && !actor.HasRole("admin") {
		if targetRole, err := service.roleInLive(ctx, session, targetId); err != nil || targetRole != RoleViewer {
			return types.RestrictionView{}, orRestriction(err, liveerrors.CannotRestrictHost)
		}
	}
	var expiresAt *time.Time
	if input.DurationMinutes > 0 {
		moment := service.Now().Add(time.Duration(input.DurationMinutes) * time.Minute)
		expiresAt = &moment
	}
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		create := tx.LiveRestriction.Create().SetLiveID(liveId).SetUserID(targetId).SetKind(input.Kind).SetImposedBy(actor.UserId).
			SetNillableExpiresAt(expiresAt)
		if input.Reason != "" {
			create.SetReason(input.Reason)
		}
		upsert := create.OnConflictColumns(liverestriction.FieldLiveID, liverestriction.FieldUserID, liverestriction.FieldKind).UpdateNewValues()
		if err := upsert.Exec(ctx); err != nil {
			return err
		}
		if input.Kind == liverestriction.KindBanned {
			if err := tx.LiveViewer.Update().Where(liveviewer.LiveID(liveId), liveviewer.UserID(targetId), liveviewer.LeftAtIsNil()).SetLeftAt(service.Now()).Exec(ctx); err != nil {
				return err
			}
		}
		eventType := events.LiveViewerMuted
		if input.Kind == liverestriction.KindBanned {
			eventType = events.LiveViewerBanned
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, liveId.String(), service.Now(), events.LiveViewerRestrictionEventData{
			LiveId: liveId.String(), UserId: targetId.String(), ActorId: actor.UserId.String(), ExpiresAt: formatOptionalTime(expiresAt),
		})
	})
	if err != nil {
		return types.RestrictionView{}, err
	}
	if input.Kind == liverestriction.KindBanned {
		if err := service.Media.RemoveParticipant(ctx, session.LivekitRoom, targetId.String()); err != nil {
			service.Logger.Warn("banned viewer was not removed from the media room", slog.String("liveId", liveId.String()), slog.Any("error", err))
		}
		_ = service.recountViewers(ctx, liveId)
	}
	return types.RestrictionView{LiveId: liveId.String(), UserId: targetId.String(), Kind: string(input.Kind), ExpiresAt: formatOptionalTime(expiresAt)}, nil
}

func (service *LiveService) LiftRestriction(ctx context.Context, actor types.Actor, liveId, targetId uuid.UUID, kind liverestriction.Kind) error {
	if _, _, err := service.requireStaffRole(ctx, actor, liveId); err != nil {
		return err
	}
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		removed, err := tx.LiveRestriction.Delete().Where(liverestriction.LiveID(liveId), liverestriction.UserID(targetId), liverestriction.KindEQ(kind)).Exec(ctx)
		if err != nil || removed == 0 {
			return err
		}
		eventType := events.LiveViewerUnmuted
		if kind == liverestriction.KindBanned {
			eventType = events.LiveViewerUnbanned
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, liveId.String(), service.Now(), events.LiveViewerRestrictionEventData{
			LiveId: liveId.String(), UserId: targetId.String(), ActorId: actor.UserId.String(),
		})
	})
}
