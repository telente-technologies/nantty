package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/guestslot"
	"zudomart/modules/live/internal/ent/livesession"
	"zudomart/modules/live/internal/ent/liveviewer"
)

type SuggestedLiveView struct {
	Id       string      `json:"id"`
	Host     UserSummary `json:"host"`
	Title    string      `json:"title"`
	CoverUrl *string     `json:"coverUrl"`
}

const suggestedLiveLimit = 20

func (application *LiveApplication) ListSuggestedLives(ctx context.Context, viewer uuid.UUID) ([]SuggestedLiveView, error) {
	rows, err := application.Client.LiveSession.Query().Where(livesession.StateEQ(livesession.StateLive), livesession.VisibilityEQ(livesession.VisibilityPublic), livesession.HostIDNEQ(viewer)).
		Order(ent.Desc(livesession.FieldViewers), ent.Desc(livesession.FieldCreatedAt)).Limit(suggestedLiveLimit).All(ctx)
	if err != nil {
		return nil, err
	}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.HostID)
	}
	participants, err := application.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return nil, err
	}
	views := make([]SuggestedLiveView, 0, len(rows))
	for _, row := range rows {
		views = append(views, SuggestedLiveView{Id: row.ID.String(), Host: summarise(participants[row.HostID]), Title: row.Title, CoverUrl: row.CoverURL})
	}
	return views, nil
}

func (application *LiveApplication) SearchViewersToInvite(ctx context.Context, actor Actor, liveId uuid.UUID, search string) ([]UserSummary, error) {
	session, err := application.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return nil, errLiveNotFound
	}
	if err != nil {
		return nil, err
	}
	if session.HostID != actor.UserId {
		return nil, errNotLiveHost
	}
	seated, err := application.Client.GuestSlot.Query().Where(guestslot.LiveID(liveId), guestslot.StateIn(occupyingSlotStates()...)).Select(guestslot.FieldUserID).Strings(ctx)
	if err != nil {
		return nil, err
	}
	seatedSet := map[string]bool{}
	for _, value := range seated {
		seatedSet[value] = true
	}
	viewerIds, err := application.Client.LiveViewer.Query().Where(liveviewer.LiveID(liveId), liveviewer.LeftAtIsNil()).Order(ent.Desc(liveviewer.FieldLastSeenAt)).Limit(200).All(ctx)
	if err != nil {
		return nil, err
	}
	candidates := make([]uuid.UUID, 0, len(viewerIds))
	for _, viewer := range viewerIds {
		if !seatedSet[viewer.UserID.String()] {
			candidates = append(candidates, viewer.UserID)
		}
	}
	participants, err := application.lookupParticipants(ctx, candidates...)
	if err != nil {
		return nil, err
	}
	needle := strings.ToLower(strings.TrimSpace(search))
	matches := []UserSummary{}
	for _, candidate := range candidates {
		summary := summarise(participants[candidate])
		if needle == "" || strings.Contains(strings.ToLower(summary.Name), needle) || strings.Contains(strings.ToLower(summary.Username), needle) {
			matches = append(matches, summary)
		}
	}
	return matches, nil
}
