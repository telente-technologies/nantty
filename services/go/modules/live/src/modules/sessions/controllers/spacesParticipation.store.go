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
	"nantty/platform/httpserver"
)

func (c SpacesController) joinSpace(ctx context.Context, id, userID uuid.UUID) (spaceparticipant.Role, int, bool, error) {
	var role spaceparticipant.Role
	var listenerCount int
	var muted bool
	err := c.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Space.Query().Where(space.ID(id)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if row.State != space.StateLive {
			return httpserver.NewApiError(http.StatusConflict, "SPACE_NOT_LIVE", "This Space is not accepting listeners.")
		}
		now := spaceTime(c)
		participant, err := tx.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(id), spaceparticipant.AccountID(userID)).ForUpdate().Only(ctx)
		changed := false
		if ent.IsNotFound(err) {
			role = spaceparticipant.RoleListener
			if userID == row.HostID {
				role = spaceparticipant.RoleHost
			}
			participant, err = tx.SpaceParticipant.Create().SetSpaceID(id).SetAccountID(userID).SetRole(role).SetJoinedAt(now).SetLastSeenAt(now).Save(ctx)
			changed = err == nil
		} else if err == nil {
			if participant.State == spaceparticipant.StateRemoved {
				return httpserver.ErrForbidden
			}
			role = participant.Role
			muted = participant.MutedByHost
			changed = participant.State != spaceparticipant.StateActive
			participant, err = participant.Update().SetState(spaceparticipant.StateActive).SetLastSeenAt(now).ClearLeftAt().Save(ctx)
		}
		if err != nil {
			return err
		}
		listenerCount, err = tx.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(id), spaceparticipant.StateEQ(spaceparticipant.StateActive), spaceparticipant.RoleEQ(spaceparticipant.RoleListener), spaceparticipant.LastSeenAtGT(now.Add(-2*time.Minute))).Count(ctx)
		if err != nil {
			return err
		}
		update := tx.Space.UpdateOneID(id).SetListeners(listenerCount)
		if listenerCount > row.PeakListeners {
			update.SetPeakListeners(listenerCount)
		}
		if _, err = update.Save(ctx); err != nil {
			return err
		}
		if changed {
			return events.EnqueueOutboxEventInTransaction(ctx, tx, "space.participantChanged", id.String(), now, map[string]any{"spaceId": id.String(), "accountId": userID.String(), "role": role, "state": "active"})
		}
		return nil
	})
	return role, listenerCount, muted, err
}
func (c SpacesController) leaveSpace(ctx context.Context, id, userID uuid.UUID) error {
	return c.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Space.Query().Where(space.ID(id)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if row.HostID == userID {
			return httpserver.NewApiError(http.StatusConflict, "SPACE_HOST_CANNOT_LEAVE", "End the Space to close the host connection.")
		}
		participant, err := tx.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(id), spaceparticipant.AccountID(userID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		if participant.State != spaceparticipant.StateActive {
			return nil
		}
		now := spaceTime(c)
		if participant.Role == spaceparticipant.RoleSpeaker {
			if err := c.Container.Media.SetParticipantCanPublish(ctx, row.LivekitRoom, userID.String(), false); err != nil {
				return err
			}
		}
		if err := participant.Update().SetState(spaceparticipant.StateLeft).SetLeftAt(now).Exec(ctx); err != nil {
			return err
		}
		count, err := tx.SpaceParticipant.Query().Where(spaceparticipant.SpaceID(id), spaceparticipant.StateEQ(spaceparticipant.StateActive), spaceparticipant.RoleEQ(spaceparticipant.RoleListener), spaceparticipant.LastSeenAtGT(now.Add(-2*time.Minute))).Count(ctx)
		if err != nil {
			return err
		}
		if err := tx.Space.UpdateOneID(id).SetListeners(count).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "space.participantChanged", id.String(), now, map[string]any{"spaceId": id.String(), "accountId": userID.String(), "state": "left"})
	})
}
