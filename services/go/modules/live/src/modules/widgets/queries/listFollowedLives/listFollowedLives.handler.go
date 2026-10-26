package listfollowedlives

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/livesession"
	"nantty/modules/live/src/modules/widgets/dtos"
	"nantty/platform/widgets"
)

const liveCandidatesScanned = 500

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.LiveNowWidgetPayload, error) {
	payload := dtos.LiveNowWidgetPayload{Lives: []dtos.LiveNowWidgetItem{}, GeneratedAt: handler.Container.Now().UTC().Format(time.RFC3339)}
	rows, err := handler.Container.Client.LiveSession.Query().
		Where(livesession.StateEQ(livesession.StateLive), livesession.HostIDNEQ(query.ViewerId), livesession.ModerationVisibilityIn("visible", "restricted")).
		Order(ent.Desc(livesession.FieldViewers), ent.Desc(livesession.FieldCreatedAt)).Limit(liveCandidatesScanned).All(ctx)
	if err != nil || len(rows) == 0 {
		return payload, err
	}
	hosts := uniqueHosts(rows)
	followed, err := handler.Container.Relations.FollowedAmong(ctx, query.ViewerId, hosts)
	if err != nil {
		return payload, err
	}
	blocked, err := handler.Container.Relations.BlockedEitherWay(ctx, query.ViewerId, hosts)
	if err != nil {
		return payload, err
	}
	visible := make([]*ent.LiveSession, 0, query.Limit)
	for _, row := range rows {
		if len(visible) == query.Limit {
			break
		}
		if !followed[row.HostID] || blocked[row.HostID] || !handler.viewerMayWatch(ctx, query.ViewerId, row) {
			continue
		}
		visible = append(visible, row)
	}
	if len(visible) == 0 {
		return payload, nil
	}
	participants, err := handler.Container.Directory.LookupParticipants(ctx, uniqueHosts(visible))
	if err != nil {
		return payload, err
	}
	for _, row := range visible {
		host := participants[row.HostID]
		payload.Lives = append(payload.Lives, dtos.LiveNowWidgetItem{
			Id: row.ID.String(), HostId: row.HostID.String(), HostName: host.Name, HostUsername: host.Username, HostAvatarUrl: host.AvatarUrl,
			Title: row.Title, Viewers: row.Viewers, StartedAt: widgets.FormatWidgetTime(row.StartedAt), DeepLink: "zudomart://live/" + row.ID.String(),
		})
	}
	return payload, nil
}

func (handler Handler) viewerMayWatch(ctx context.Context, viewerId uuid.UUID, row *ent.LiveSession) bool {
	if row.Visibility != livesession.VisibilitySubscribers {
		return true
	}
	if handler.Container.Relations == nil {
		return false
	}
	subscribed, err := handler.Container.Relations.IsActiveSubscriber(ctx, viewerId, row.HostID)
	return err == nil && subscribed
}

func uniqueHosts(rows []*ent.LiveSession) []uuid.UUID {
	seen := map[uuid.UUID]bool{}
	hosts := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		if !seen[row.HostID] {
			seen[row.HostID] = true
			hosts = append(hosts, row.HostID)
		}
	}
	return hosts
}
