package listactivity

import (
	"context"
	"encoding/json"
	"time"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adactivityentry"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	"zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/utils"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.ActivityEntry, string, error) {
	deployed := handler.Container
	if _, err := services.RequireAccountPermission(ctx, deployed.Client, query.AccountId, query.UserId, services.PermissionAccountView); err != nil {
		return nil, "", err
	}
	request := deployed.Client.AdActivityEntry.Query().Where(adactivityentry.AccountID(query.AccountId))
	if query.ObjectType != "" {
		request.Where(adactivityentry.ObjectType(query.ObjectType))
	}
	if query.Cursor != nil {
		request.Where(adactivityentry.IDLT(*query.Cursor))
	}
	rows, err := request.Order(adactivityentry.ByID(sqlDesc())).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	entries := make([]dtos.ActivityEntry, 0, len(rows))
	for _, row := range rows {
		var changes any
		_ = json.Unmarshal(row.Changes, &changes)
		entries = append(entries, dtos.ActivityEntry{Id: row.ID.String(), ObjectType: row.ObjectType, ObjectId: row.ObjectID, Actor: actorLabel(row.ActorName), Summary: row.Summary, Changes: changes, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339)})
	}
	return entries, nextCursor, nil
}

func actorLabel(name string) string {
	if name == "" {
		return "System"
	}
	return name
}
