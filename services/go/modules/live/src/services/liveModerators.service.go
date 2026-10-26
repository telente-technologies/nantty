package services

import (
	"context"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livemoderator"
	"nantty/modules/live/src/types"
)

func (service *LiveService) requireHost(ctx context.Context, actor types.Actor, liveId uuid.UUID) (*ent.LiveSession, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return nil, liveerrors.LiveNotFound
	}
	if err != nil {
		return nil, err
	}
	if session.HostID != actor.UserId {
		return nil, liveerrors.NotLiveHost
	}
	return session, nil
}

func (service *LiveService) GrantModerator(ctx context.Context, actor types.Actor, liveId, userId uuid.UUID) error {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return err
	}
	if userId == actor.UserId {
		return liveerrors.Unprocessable("CANNOT_MODERATE_SELF", "You already host this live.")
	}
	known, err := service.Directory.LookupParticipants(ctx, []uuid.UUID{userId})
	if err != nil {
		return err
	}
	if _, exists := known[userId]; !exists {
		return liveerrors.Unprocessable("USER_NOT_FOUND", "That person could not be found.")
	}
	return service.Client.LiveModerator.Create().SetLiveID(liveId).SetUserID(userId).SetGrantedBy(actor.UserId).
		OnConflictColumns(livemoderator.FieldLiveID, livemoderator.FieldUserID).Ignore().Exec(ctx)
}

func (service *LiveService) RevokeModerator(ctx context.Context, actor types.Actor, liveId, userId uuid.UUID) error {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return err
	}
	_, err := service.Client.LiveModerator.Delete().Where(livemoderator.LiveID(liveId), livemoderator.UserID(userId)).Exec(ctx)
	return err
}

func (service *LiveService) ListModerators(ctx context.Context, actor types.Actor, liveId uuid.UUID) ([]types.ModeratorView, error) {
	if _, err := service.requireHost(ctx, actor, liveId); err != nil {
		return nil, err
	}
	rows, err := service.Client.LiveModerator.Query().Where(livemoderator.LiveID(liveId)).Order(ent.Asc(livemoderator.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.UserID)
	}
	participants, err := service.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return nil, err
	}
	views := make([]types.ModeratorView, 0, len(rows))
	for _, row := range rows {
		views = append(views, types.ModeratorView{User: summarise(participants[row.UserID]), GrantedAt: formatTime(row.CreatedAt)})
	}
	return views, nil
}
