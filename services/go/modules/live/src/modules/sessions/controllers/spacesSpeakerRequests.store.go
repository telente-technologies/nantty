package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/events"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/space"
	"nantty/modules/live/src/generated/ent/spaceparticipant"
	"nantty/modules/live/src/generated/ent/spacespeakerrequest"
	"nantty/platform/httpserver"
)

func (c SpacesController) requestSpeaker(ctx context.Context, id, userID uuid.UUID) (*ent.SpaceSpeakerRequest, error) {
	var saved *ent.SpaceSpeakerRequest
	err := c.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Space.Query().Where(space.ID(id)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if row.State != space.StateLive {
			return httpserver.NewApiError(http.StatusConflict, "SPACE_NOT_LIVE", "Speaker requests are closed.")
		}
		participant, err := tx.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(id), spaceparticipant.AccountID(userID), spaceparticipant.StateEQ(spaceparticipant.StateActive)).Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrForbidden
		}
		if err != nil {
			return err
		}
		if participant.Role != spaceparticipant.RoleListener {
			return httpserver.NewApiError(http.StatusConflict, "SPACE_ALREADY_SPEAKER", "Only listeners can request to speak.")
		}
		pending, err := tx.SpaceSpeakerRequest.Query().Where(spacespeakerrequest.SpaceID(id), spacespeakerrequest.AccountID(userID), spacespeakerrequest.StateEQ(spacespeakerrequest.StatePending), spacespeakerrequest.ExpiresAtGT(spaceTime(c))).Only(ctx)
		if err == nil {
			saved = pending
			return nil
		}
		if !ent.IsNotFound(err) {
			return err
		}
		now := spaceTime(c)
		if err := tx.SpaceSpeakerRequest.Update().Where(spacespeakerrequest.SpaceID(id), spacespeakerrequest.AccountID(userID), spacespeakerrequest.StateEQ(spacespeakerrequest.StatePending), spacespeakerrequest.ExpiresAtLTE(now)).SetState(spacespeakerrequest.StateCancelled).Exec(ctx); err != nil {
			return err
		}
		saved, err = tx.SpaceSpeakerRequest.Create().SetSpaceID(id).SetAccountID(userID).SetExpiresAt(now.Add(24 * time.Hour)).Save(ctx)
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "space.speakerRequested", id.String(), now, map[string]any{"spaceId": id.String(), "requestId": saved.ID.String(), "accountId": userID.String()})
	})
	return saved, err
}

func (c SpacesController) decideSpeakerRequest(ctx context.Context, spaceID, requestID, actorID uuid.UUID, approve bool) error {
	return c.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Space.Query().Where(space.ID(spaceID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if err := c.requireSpaceModerator(ctx, row, actorID); err != nil {
			return err
		}
		request, err := tx.SpaceSpeakerRequest.Query().Where(spacespeakerrequest.ID(requestID), spacespeakerrequest.SpaceID(spaceID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if request.State != spacespeakerrequest.StatePending || !request.ExpiresAt.After(spaceTime(c)) {
			return httpserver.NewApiError(http.StatusConflict, "SPACE_REQUEST_CLOSED", "This speaker request is no longer open.")
		}
		participant, err := tx.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(spaceID), spaceparticipant.AccountID(request.AccountID), spaceparticipant.StateEQ(spaceparticipant.StateActive)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.NewApiError(http.StatusConflict, "SPACE_LISTENER_LEFT", "The listener has left the Space.")
		}
		if err != nil {
			return err
		}
		now := spaceTime(c)
		state := spacespeakerrequest.StateDeclined
		role := participant.Role
		if approve {
			state = spacespeakerrequest.StateApproved
			role = spaceparticipant.RoleSpeaker
			if err := c.Container.Media.SetParticipantCanPublish(ctx, row.LivekitRoom, request.AccountID.String(), true); err != nil {
				return err
			}
		}
		if err := request.Update().SetState(state).SetDecidedBy(actorID).SetDecidedAt(now).Exec(ctx); err != nil {
			return err
		}
		if approve {
			if err := participant.Update().SetRole(role).SetMutedByHost(false).Exec(ctx); err != nil {
				return err
			}
		}
		eventType := "space.speakerDeclined"
		if approve {
			eventType = "space.speakerApproved"
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, spaceID.String(), now, map[string]any{"spaceId": spaceID.String(), "requestId": requestID.String(), "accountId": request.AccountID.String(), "actorId": actorID.String()})
	})
}

func (c SpacesController) controlSpaceParticipant(ctx context.Context, spaceID, userID, actorID uuid.UUID, action string) error {
	return c.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Space.Query().Where(space.ID(spaceID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if err := c.requireSpaceModerator(ctx, row, actorID); err != nil {
			return err
		}
		participant, err := tx.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(spaceID), spaceparticipant.AccountID(userID), spaceparticipant.StateEQ(spaceparticipant.StateActive)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if participant.Role == spaceparticipant.RoleHost {
			return httpserver.ErrForbidden
		}
		now := spaceTime(c)
		update := participant.Update()
		switch action {
		case "remove":
			if err := c.Container.Media.RemoveParticipant(ctx, row.LivekitRoom, userID.String()); err != nil {
				return err
			}
			update.SetState(spaceparticipant.StateRemoved).SetLeftAt(now)
		case "demote":
			if participant.Role != spaceparticipant.RoleSpeaker {
				return httpserver.NewApiError(http.StatusConflict, "SPACE_NOT_SPEAKER", "Only speakers can be demoted.")
			}
			if err := c.Container.Media.SetParticipantCanPublish(ctx, row.LivekitRoom, userID.String(), false); err != nil {
				return err
			}
			update.SetRole(spaceparticipant.RoleListener).SetMutedByHost(false)
		default:
			return httpserver.NewApiError(http.StatusBadRequest, "SPACE_ACTION_INVALID", "Unsupported participant action.")
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		count, err := tx.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(spaceID), spaceparticipant.StateEQ(spaceparticipant.StateActive), spaceparticipant.RoleEQ(spaceparticipant.RoleListener), spaceparticipant.LastSeenAtGT(now.Add(-2*time.Minute))).Count(ctx)
		if err != nil {
			return err
		}
		if err := tx.Space.UpdateOneID(spaceID).SetListeners(count).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "space.participantChanged", spaceID.String(), now, map[string]any{"spaceId": spaceID.String(), "accountId": userID.String(), "actorId": actorID.String(), "action": action})
	})
}

func (c SpacesController) muteSpeaker(ctx context.Context, spaceID, userID, actorID uuid.UUID, muted bool) error {
	return c.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Space.Query().Where(space.ID(spaceID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if err := c.requireSpaceModerator(ctx, row, actorID); err != nil {
			return err
		}
		participant, err := tx.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(spaceID), spaceparticipant.AccountID(userID), spaceparticipant.StateEQ(spaceparticipant.StateActive)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if participant.Role != spaceparticipant.RoleSpeaker {
			return httpserver.NewApiError(http.StatusConflict, "SPACE_NOT_SPEAKER", "Only speakers can be muted.")
		}
		if err := c.Container.Media.SetParticipantCanPublish(ctx, row.LivekitRoom, userID.String(), !muted); err != nil {
			return err
		}
		if err := c.Container.Media.SetParticipantTracksMuted(ctx, row.LivekitRoom, userID.String(), &muted, nil); err != nil {
			return err
		}
		now := spaceTime(c)
		if err := participant.Update().SetMutedByHost(muted).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "space.participantChanged", spaceID.String(), now, map[string]any{"spaceId": spaceID.String(), "accountId": userID.String(), "actorId": actorID.String(), "action": "mute", "muted": muted})
	})
}
