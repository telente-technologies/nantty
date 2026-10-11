package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/guestslot"
	"zudomart/modules/live/src/generated/ent/livesafetystate"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/interfaces"
	"zudomart/modules/live/src/types"
)

const warningDisplayWindow = 2 * time.Minute

func (service *LiveService) lockOrCreateSafetyState(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, now time.Time) (*ent.LiveSafetyState, error) {
	if err := tx.LiveSafetyState.Create().SetLiveID(session.ID).SetHostID(session.HostID).SetCreatedAt(now).SetUpdatedAt(now).OnConflictColumns(livesafetystate.FieldLiveID).DoNothing().Exec(ctx); err != nil && !ent.IsNotFound(err) && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return tx.LiveSafetyState.Query().Where(livesafetystate.LiveID(session.ID)).ForUpdate().Only(ctx)
}

func (service *LiveService) ApplyLiveSafetyHold(ctx context.Context, command types.LiveSafetyHoldCommand) error {
	session, err := service.findSessionForSafety(ctx, command.LiveId)
	if err != nil || session == nil || session.State == livesession.StateEnded {
		return err
	}
	now := service.Now()
	changed := false
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		state, err := service.lockOrCreateSafetyState(ctx, tx, session, now)
		if err != nil || (state.HoldActive && state.HoldIncidentID == command.IncidentId) {
			return err
		}
		changed = true
		if err := tx.LiveSafetyState.UpdateOne(state).SetHoldActive(true).SetHoldIncidentID(command.IncidentId).SetHoldCategory(command.Category).SetHoldReason(truncateRunes(command.Reason, 300)).
			SetHoldSource(command.Source).SetHoldStartedAt(now).SetUpdatedAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveSafetyPaused, session.ID.String(), now, events.LiveSafetyViewerEventData{LiveId: session.ID.String(), State: "paused", Message: events.ViewerPausedMessage, At: formatTime(now)}); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveSafetyHostNotice, session.HostID.String(), now, events.LiveSafetyHostNoticeData{
			LiveId: session.ID.String(), HostId: session.HostID.String(), Kind: "hold", Category: command.Category, Message: command.Reason, IncidentId: command.IncidentId, Appealable: true, At: formatTime(now),
		})
	})
	if err == nil && changed {
		service.setPublishersAllowed(ctx, session, false)
	}
	return err
}

func (service *LiveService) ReleaseLiveSafetyHold(ctx context.Context, liveId, incidentId string) error {
	session, err := service.findSessionForSafety(ctx, liveId)
	if err != nil || session == nil {
		return err
	}
	now := service.Now()
	released := false
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		state, err := service.lockOrCreateSafetyState(ctx, tx, session, now)
		if err != nil || !state.HoldActive || state.HoldIncidentID != incidentId {
			return err
		}
		released = true
		if err := tx.LiveSafetyState.UpdateOne(state).SetHoldActive(false).SetUpdatedAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveSafetyResumed, session.ID.String(), now, events.LiveSafetyViewerEventData{LiveId: session.ID.String(), State: "live", Message: "", At: formatTime(now)}); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveSafetyHostNotice, session.HostID.String(), now, events.LiveSafetyHostNoticeData{
			LiveId: session.ID.String(), HostId: session.HostID.String(), Kind: "released", Message: "Our safety team reviewed your live. You're back on air.", IncidentId: incidentId, At: formatTime(now),
		})
	})
	if err == nil && released && session.State != livesession.StateEnded {
		service.setPublishersAllowed(ctx, session, true)
	}
	return err
}

func (service *LiveService) WarnLiveHost(ctx context.Context, liveId, incidentId, category, message string) error {
	session, err := service.findSessionForSafety(ctx, liveId)
	if err != nil || session == nil || session.State == livesession.StateEnded {
		return err
	}
	now := service.Now()
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		state, err := service.lockOrCreateSafetyState(ctx, tx, session, now)
		if err != nil {
			return err
		}
		if err := tx.LiveSafetyState.UpdateOne(state).SetWarningMessage(truncateRunes(message, 300)).SetWarnedAt(now).SetUpdatedAt(now).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveSafetyHostNotice, session.HostID.String(), now, events.LiveSafetyHostNoticeData{
			LiveId: session.ID.String(), HostId: session.HostID.String(), Kind: "warning", Category: category, Message: message, IncidentId: incidentId, At: formatTime(now),
		})
	})
}

func (service *LiveService) BoostLiveSafetySampling(ctx context.Context, liveId string, until time.Time) error {
	session, err := service.findSessionForSafety(ctx, liveId)
	if err != nil || session == nil || session.State == livesession.StateEnded {
		return err
	}
	now := service.Now()
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		state, err := service.lockOrCreateSafetyState(ctx, tx, session, now)
		if err != nil || (state.SamplingBoostUntil != nil && !state.SamplingBoostUntil.Before(until)) {
			return err
		}
		return tx.LiveSafetyState.UpdateOne(state).SetSamplingBoostUntil(until).SetUpdatedAt(now).Exec(ctx)
	})
}

func (service *LiveService) EndLiveByModerator(ctx context.Context, liveId, incidentId, reason string) error {
	session, err := service.findSessionForSafety(ctx, liveId)
	if err != nil || session == nil || session.State == livesession.StateEnded {
		return err
	}
	now := service.Now()
	if err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveSafetyHostNotice, session.HostID.String(), now, events.LiveSafetyHostNoticeData{
			LiveId: session.ID.String(), HostId: session.HostID.String(), Kind: "ended", Message: "Our safety team ended your live: " + truncateRunes(reason, 200), IncidentId: incidentId, Appealable: true, At: formatTime(now),
		})
	}); err != nil {
		return err
	}
	return service.EndLiveSession(ctx, types.Actor{UserId: session.HostID}, session.ID)
}

func (service *LiveService) findSessionForSafety(ctx context.Context, liveId string) (*ent.LiveSession, error) {
	identifier, err := uuid.Parse(liveId)
	if err != nil {
		return nil, nil
	}
	session, err := service.Client.LiveSession.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return session, err
}

func (service *LiveService) setPublishersAllowed(ctx context.Context, session *ent.LiveSession, allowed bool) {
	identities := []string{session.HostID.String()}
	guests, err := service.Client.GuestSlot.Query().Where(guestslot.LiveID(session.ID), guestslot.StateIn(occupyingSlotStates()...)).All(ctx)
	if err == nil {
		for _, guest := range guests {
			identities = append(identities, guest.UserID.String())
		}
	}
	muted := !allowed
	permissions, canChangePermissions := service.Media.(interfaces.PublishPermissionController)
	for _, identity := range identities {
		if canChangePermissions {
			service.bestEffortMedia(ctx, "safety publish permission", permissions.SetParticipantCanPublish(ctx, session.LivekitRoom, identity, allowed))
		}
		if !allowed {
			service.bestEffortMedia(ctx, "safety mute", service.Media.SetParticipantTracksMuted(ctx, session.LivekitRoom, identity, &muted, &muted))
		}
	}
}

func (service *LiveService) LiveSafetyViewFor(ctx context.Context, session *ent.LiveSession, viewer uuid.UUID) *types.LiveSafetyView {
	state, err := service.Client.LiveSafetyState.Query().Where(livesafetystate.LiveID(session.ID)).Only(ctx)
	if err != nil {
		return nil
	}
	return PresentLiveSafety(state, viewer == session.HostID, service.Now())
}

func PresentLiveSafety(state *ent.LiveSafetyState, isHost bool, now time.Time) *types.LiveSafetyView {
	showsWarning := isHost && state.WarnedAt != nil && now.Sub(*state.WarnedAt) < warningDisplayWindow
	if !state.HoldActive && !showsWarning {
		return nil
	}
	view := &types.LiveSafetyView{State: "warning"}
	if state.HoldActive {
		view.State, view.ViewerMessage, view.HeldAt = "paused", events.ViewerPausedMessage, formatOptionalTime(state.HoldStartedAt)
	}
	if !isHost {
		return view
	}
	if state.HoldActive {
		view.HostReason, view.Category, view.Appealable = &state.HoldReason, &state.HoldCategory, true
	}
	if showsWarning {
		view.WarningMessage, view.WarnedAt = &state.WarningMessage, formatOptionalTime(state.WarnedAt)
	}
	return view
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
