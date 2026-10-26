package liststorevisitors

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/storevisitor"
	"nantty/modules/catalog/src/modules/internalSources/dtos"
	"nantty/modules/catalog/src/modules/internalSources/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.AudienceMember], error) {
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return httpserver.CursorPage[dtos.AudienceMember]{}, err
	}
	request := handler.Container.Client.StoreVisitor.Query().Where(storevisitor.StoreID(query.StoreId), storevisitor.LastVisitedAtGTE(query.VisitedSince))
	if after != nil {
		request.Where(storevisitor.IDGT(*after))
	}
	rows, err := request.Order(ent.Asc(storevisitor.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.AudienceMember]{}, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = utils.IdentifierCursor(rows[len(rows)-1].ID)
	}
	accountIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		accountIds = append(accountIds, row.AccountID)
	}
	consenting, err := handler.Container.Users.AccountsAllowingPersonalizedAds(ctx, accountIds)
	if err != nil {
		return httpserver.CursorPage[dtos.AudienceMember]{}, err
	}
	allowed := map[uuid.UUID]bool{}
	for _, accountId := range consenting {
		allowed[accountId] = true
	}
	members := make([]dtos.AudienceMember, 0, len(rows))
	for _, row := range rows {
		if allowed[row.AccountID] {
			members = append(members, dtos.AudienceMember{AccountId: row.AccountID.String(), LastActiveAt: services.Timestamp(row.LastVisitedAt), Interactions: row.VisitCount})
		}
	}
	return httpserver.NewCursorPage(members, nextCursor), nil
}
