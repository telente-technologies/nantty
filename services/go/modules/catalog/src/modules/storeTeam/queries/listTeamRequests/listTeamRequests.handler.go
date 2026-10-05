package listteamrequests

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/store"
	"zudomart/modules/catalog/src/generated/ent/storemember"
	"zudomart/modules/catalog/src/modules/storeTeam/dtos"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.TeamRequestView], error) {
	invites, err := handler.Container.Client.StoreMember.Query().Where(storemember.AccountID(query.AccountId), storemember.Status("invited")).Order(ent.Desc(storemember.FieldID)).Limit(50).All(ctx)
	if err != nil || len(invites) == 0 {
		return httpserver.NewCursorPage([]dtos.TeamRequestView{}, ""), err
	}
	storeIds := make([]uuid.UUID, 0, len(invites))
	for _, invite := range invites {
		storeIds = append(storeIds, invite.StoreID)
	}
	stores, err := handler.Container.Client.Store.Query().Where(store.IDIn(storeIds...)).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.TeamRequestView]{}, err
	}
	byId := map[uuid.UUID]*ent.Store{}
	for _, row := range stores {
		byId[row.ID] = row
	}
	views := make([]dtos.TeamRequestView, 0, len(invites))
	for _, invite := range invites {
		row, found := byId[invite.StoreID]
		if !found || row.Status == "closed" {
			continue
		}
		views = append(views, dtos.TeamRequestView{Id: invite.ID.String(), StoreId: row.ID.String(), StoreName: row.Name, StoreLogo: row.LogoURL, Role: invite.Role, InvitedAt: invite.CreatedAt.UTC().Format(time.RFC3339)})
	}
	return httpserver.NewCursorPage(views, ""), nil
}
