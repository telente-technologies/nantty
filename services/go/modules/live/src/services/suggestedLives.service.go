package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/types"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/guestslot"
	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/modules/live/src/generated/ent/liveviewer"
)

const suggestedLiveLimit = 20

func (service *LiveService) ListSuggestedLives(ctx context.Context, viewer uuid.UUID) ([]types.SuggestedLiveView, error) {
	rows, err := service.Client.LiveSession.Query().Where(livesession.StateEQ(livesession.StateLive), livesession.VisibilityEQ(livesession.VisibilityPublic), livesession.HostIDNEQ(viewer), livesession.ModerationVisibilityIn("visible", "restricted")).
		Order(ent.Desc(livesession.FieldViewers), ent.Desc(livesession.FieldCreatedAt)).Limit(suggestedLiveLimit).All(ctx)
	if err != nil {
		return nil, err
	}
	if rows, err = service.withoutLivesOfPrivateHostsHiddenFrom(ctx, viewer, rows); err != nil {
		return nil, err
	}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.HostID)
	}
	participants, err := service.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return nil, err
	}
	views := make([]types.SuggestedLiveView, 0, len(rows))
	for _, row := range rows {
		views = append(views, types.SuggestedLiveView{Id: row.ID.String(), Host: summarise(participants[row.HostID]), Title: row.Title, CoverUrl: row.CoverURL})
	}
	return views, nil
}

func (service *LiveService) SearchViewersToInvite(ctx context.Context, actor types.Actor, liveId uuid.UUID, search string) ([]types.UserSummary, error) {
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
	seated, err := service.Client.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.StateIn(occupyingSlotStates()...)).Select(guestslot.FieldUserID).Strings(ctx)
	if err != nil {
		return nil, err
	}
	seatedSet := map[string]bool{}
	for _, value := range seated {
		seatedSet[value] = true
	}
	viewerIds, err := service.Client.LiveViewer.Query().Where(liveviewer.LiveID(liveId), liveviewer.LeftAtIsNil()).Order(ent.Desc(liveviewer.FieldLastSeenAt)).Limit(200).All(ctx)
	if err != nil {
		return nil, err
	}
	candidates := make([]uuid.UUID, 0, len(viewerIds))
	for _, viewer := range viewerIds {
		if !seatedSet[viewer.UserID.String()] {
			candidates = append(candidates, viewer.UserID)
		}
	}
	participants, err := service.lookupParticipants(ctx, candidates...)
	if err != nil {
		return nil, err
	}
	needle := strings.ToLower(strings.TrimSpace(search))
	matches := []types.UserSummary{}
	for _, candidate := range candidates {
		summary := summarise(participants[candidate])
		if needle == "" || strings.Contains(strings.ToLower(summary.Name), needle) || strings.Contains(strings.ToLower(summary.Username), needle) {
			matches = append(matches, summary)
		}
	}
	return matches, nil
}
