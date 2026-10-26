package services

import (
	"context"

	"github.com/google/uuid"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livehostdefault"
	"nantty/modules/live/src/generated/ent/livemoderator"
	"nantty/modules/live/src/generated/ent/liveroomsetting"
	"nantty/modules/live/src/types"
)

const (
	CommentAudienceEveryone    = "everyone"
	CommentAudienceFollowers   = "followers"
	CommentAudienceSubscribers = "subscribers"
	maximumDefaultModerators   = 20
)

func (service *LiveService) GetHostDefaults(ctx context.Context, actor types.Actor) (types.HostDefaultsView, error) {
	row, err := service.Client.LiveHostDefault.Get(ctx, actor.UserId)
	if ent.IsNotFound(err) {
		return types.HostDefaultsView{CommentsEnabled: true, CommentAudience: CommentAudienceEveryone, BlockedWords: []string{}, Moderators: []types.UserSummary{}}, nil
	}
	if err != nil {
		return types.HostDefaultsView{}, err
	}
	return service.presentHostDefaults(ctx, row)
}

func (service *LiveService) UpdateHostDefaults(ctx context.Context, actor types.Actor, input types.HostDefaultsInput) (types.HostDefaultsView, error) {
	var blockedWords []string
	if input.BlockedWords != nil {
		cleaned, err := NormaliseBlockedWords(*input.BlockedWords)
		if err != nil {
			return types.HostDefaultsView{}, err
		}
		blockedWords = cleaned
	}
	var moderatorIds []string
	if input.ModeratorIds != nil {
		cleaned, err := service.normaliseDefaultModerators(ctx, actor.UserId, *input.ModeratorIds)
		if err != nil {
			return types.HostDefaultsView{}, err
		}
		moderatorIds = cleaned
	}
	var saved *ent.LiveHostDefault
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.LiveHostDefault.Create().SetID(actor.UserId).OnConflictColumns(livehostdefault.FieldID).Ignore().Exec(ctx); err != nil {
			return err
		}
		update := tx.LiveHostDefault.UpdateOneID(actor.UserId)
		if input.CommentsEnabled != nil {
			update.SetCommentsEnabled(*input.CommentsEnabled)
		}
		if input.CommentAudience != nil {
			update.SetCommentAudience(livehostdefault.CommentAudience(*input.CommentAudience))
		}
		if input.SlowModeSeconds != nil {
			update.SetSlowModeSeconds(*input.SlowModeSeconds)
		}
		if input.BlockedWords != nil {
			update.SetBlockedWords(blockedWords)
		}
		if input.ModeratorIds != nil {
			update.SetModeratorIds(moderatorIds)
		}
		var err error
		saved, err = update.Save(ctx)
		return err
	})
	if err != nil {
		return types.HostDefaultsView{}, err
	}
	return service.presentHostDefaults(ctx, saved)
}

func (service *LiveService) normaliseDefaultModerators(ctx context.Context, hostId uuid.UUID, raw []uuid.UUID) ([]string, error) {
	seen := map[uuid.UUID]bool{}
	unique := make([]uuid.UUID, 0, len(raw))
	for _, identifier := range raw {
		if identifier == hostId {
			return nil, liveerrors.ModeratorSelf
		}
		if !seen[identifier] {
			seen[identifier] = true
			unique = append(unique, identifier)
		}
	}
	if len(unique) > maximumDefaultModerators {
		return nil, liveerrors.Unprocessable("MODERATOR_LIMIT", "You can have at most 20 default moderators.")
	}
	known, err := service.Directory.LookupParticipants(ctx, unique)
	if err != nil {
		return nil, err
	}
	identifiers := make([]string, 0, len(unique))
	for _, identifier := range unique {
		if _, exists := known[identifier]; !exists {
			return nil, liveerrors.Unprocessable("USER_NOT_FOUND", "That person could not be found.")
		}
		identifiers = append(identifiers, identifier.String())
	}
	return identifiers, nil
}

func (service *LiveService) presentHostDefaults(ctx context.Context, row *ent.LiveHostDefault) (types.HostDefaultsView, error) {
	moderatorIds := parseStoredIdentifiers(row.ModeratorIds)
	participants, err := service.lookupParticipants(ctx, moderatorIds...)
	if err != nil {
		return types.HostDefaultsView{}, err
	}
	moderators := make([]types.UserSummary, 0, len(moderatorIds))
	for _, identifier := range moderatorIds {
		if participant, found := participants[identifier]; found {
			moderators = append(moderators, summarise(participant))
		}
	}
	updatedAt := formatTime(row.UpdatedAt)
	return types.HostDefaultsView{
		CommentsEnabled: row.CommentsEnabled, CommentAudience: string(row.CommentAudience), SlowModeSeconds: row.SlowModeSeconds,
		BlockedWords: append([]string{}, row.BlockedWords...), Moderators: moderators, UpdatedAt: &updatedAt,
	}, nil
}

func parseStoredIdentifiers(raw []string) []uuid.UUID {
	identifiers := make([]uuid.UUID, 0, len(raw))
	for _, value := range raw {
		if identifier, err := uuid.Parse(value); err == nil {
			identifiers = append(identifiers, identifier)
		}
	}
	return identifiers
}

func (service *LiveService) applyHostDefaultsInTransaction(ctx context.Context, tx *ent.Tx, liveId, hostId uuid.UUID) error {
	defaults, err := tx.LiveHostDefault.Get(ctx, hostId)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	err = tx.LiveRoomSetting.Create().SetID(liveId).SetCommentsEnabled(defaults.CommentsEnabled).SetSlowModeSeconds(defaults.SlowModeSeconds).
		SetBlockedWords(defaults.BlockedWords).SetCommentAudience(liveroomsetting.CommentAudience(defaults.CommentAudience)).Exec(ctx)
	if err != nil {
		return err
	}
	for _, moderatorId := range parseStoredIdentifiers(defaults.ModeratorIds) {
		if err := tx.LiveModerator.Create().SetLiveID(liveId).SetUserID(moderatorId).SetGrantedBy(hostId).
			OnConflictColumns(livemoderator.FieldLiveID, livemoderator.FieldUserID).Ignore().Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}
