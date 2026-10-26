package services

import (
	"context"
	"strings"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/modules/live/src/types"
)

const (
	minimumScheduleLead  = time.Minute
	maximumScheduleAhead = 90 * 24 * time.Hour
	reminderLead         = 15 * time.Minute
)

func (service *LiveService) validateSchedule(scheduledAt time.Time) error {
	now := service.Now()
	if scheduledAt.Before(now.Add(minimumScheduleLead)) {
		return liveerrors.Unprocessable("SCHEDULE_IN_PAST", "Pick a time at least a minute from now.")
	}
	if scheduledAt.After(now.Add(maximumScheduleAhead)) {
		return liveerrors.Unprocessable("SCHEDULE_TOO_FAR", "You can schedule a live up to 90 days ahead.")
	}
	return nil
}

func scheduledEventData(session *ent.LiveSession) events.LiveScheduledEventData {
	return events.LiveScheduledEventData{
		LiveId: session.ID.String(), HostId: session.HostID.String(), Title: session.Title, Category: string(session.Category), ScheduledAt: formatTime(*session.ScheduledAt),
	}
}

func (service *LiveService) UpdateLiveDetails(ctx context.Context, actor types.Actor, liveId uuid.UUID, input types.UpdateLiveDetailsInput) (types.LiveSessionView, error) {
	if input.ChangeSchedule && input.ScheduledAt != nil {
		if err := service.validateSchedule(*input.ScheduledAt); err != nil {
			return types.LiveSessionView{}, err
		}
	}
	var updated *ent.LiveSession
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return liveerrors.NotLiveHost
		}
		if session.State != livesession.StateIdle {
			return liveerrors.LiveNotEditable
		}
		update := session.Update()
		if input.Title != nil {
			update.SetTitle(strings.TrimSpace(*input.Title))
		}
		if input.Category != nil {
			update.SetCategory(livesession.Category(*input.Category))
		}
		if input.ChangeSchedule {
			update.SetNillableScheduledAt(input.ScheduledAt).ClearReminderSentAt()
			if input.ScheduledAt == nil {
				update.ClearScheduledAt()
			}
		}
		if updated, err = update.Save(ctx); err != nil {
			return err
		}
		if input.ChangeSchedule && updated.ScheduledAt != nil {
			return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveScheduled, liveId.String(), service.Now(), scheduledEventData(updated))
		}
		if input.ChangeSchedule && session.ScheduledAt != nil {
			return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveScheduleCancelled, liveId.String(), service.Now(), events.LiveScheduleCancelledEventData{LiveId: liveId.String(), HostId: session.HostID.String()})
		}
		return nil
	})
	if err != nil {
		return types.LiveSessionView{}, err
	}
	return service.presentLiveSession(ctx, updated)
}

func (service *LiveService) CancelLiveSession(ctx context.Context, actor types.Actor, liveId uuid.UUID) error {
	return service.endLive(ctx, liveId, func(session *ent.LiveSession) (bool, error) {
		if session.HostID != actor.UserId {
			return false, liveerrors.NotLiveHost
		}
		if session.State != livesession.StateIdle {
			return false, liveerrors.LiveNotEditable
		}
		return true, nil
	}, func(tx *ent.Tx, session *ent.LiveSession) error {
		if session.ScheduledAt == nil {
			return nil
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveScheduleCancelled, liveId.String(), service.Now(), events.LiveScheduleCancelledEventData{LiveId: liveId.String(), HostId: session.HostID.String()})
	})
}

func (service *LiveService) sweepDueLiveReminders(ctx context.Context) error {
	due, err := service.Client.LiveSession.Query().Where(
		livesession.StateEQ(livesession.StateIdle), livesession.ReminderSentAtIsNil(), livesession.ScheduledAtLTE(service.Now().Add(reminderLead)),
	).Limit(timerBatchSize).IDs(ctx)
	if err != nil {
		return err
	}
	for _, liveId := range due {
		if err := service.sendOneLiveReminder(ctx, liveId); err != nil {
			return err
		}
	}
	return nil
}

func (service *LiveService) sendOneLiveReminder(ctx context.Context, liveId uuid.UUID) error {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if err != nil {
		return err
	}
	audience := service.resolveLiveStartedAudience(ctx, session.HostID, string(session.Visibility))
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.LiveSession.Query().Where(livesession.ID(liveId), livesession.StateEQ(livesession.StateIdle), livesession.ReminderSentAtIsNil(), livesession.ScheduledAtNotNil()).
			ForUpdate(sql.WithLockAction(sql.SkipLocked)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		now := service.Now()
		if err := locked.Update().SetReminderSentAt(now).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveReminderDue, liveId.String(), now, events.LiveReminderDueEventData{
			LiveId: liveId.String(), HostId: locked.HostID.String(), Title: locked.Title, ScheduledAt: formatTime(*locked.ScheduledAt),
			Host: audience.Host, HostName: audience.Host.Name, HostHandle: audience.Host.Username, NotifyUserIds: audience.Recipient, NotifyTruncated: audience.Truncated,
		})
	})
}
