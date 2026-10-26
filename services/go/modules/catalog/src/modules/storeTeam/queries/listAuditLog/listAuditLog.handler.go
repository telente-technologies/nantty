package listauditlog

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/storeauditentry"
	"nantty/modules/catalog/src/modules/storeTeam/dtos"
	"nantty/modules/catalog/src/modules/storeTeam/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.AuditLogEntryView], error) {
	before, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return httpserver.CursorPage[dtos.AuditLogEntryView]{}, err
	}
	filter := handler.Container.Client.StoreAuditEntry.Query().Where(storeauditentry.StoreID(query.Store.StoreId))
	if query.ActorId != "" {
		filter = filter.Where(storeauditentry.ActorID(query.ActorId))
	}
	if query.ActionPrefix != "" {
		filter = filter.Where(storeauditentry.ActionHasPrefix(query.ActionPrefix))
	}
	if query.From != nil {
		filter = filter.Where(storeauditentry.CreatedAtGTE(*query.From))
	}
	if query.Until != nil {
		filter = filter.Where(storeauditentry.CreatedAtLT(*query.Until))
	}
	if before != nil {
		filter = filter.Where(storeauditentry.IDLT(*before))
	}
	rows, err := filter.Order(ent.Desc(storeauditentry.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.AuditLogEntryView]{}, err
	}
	return utils.PageFromOverfetchedRows(rows, query.Limit, services.PresentAuditEntry, func(row *ent.StoreAuditEntry) string { return utils.IdentifierCursor(row.ID) }), nil
}
