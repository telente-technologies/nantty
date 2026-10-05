package listapplications

import (
	"context"
	"strings"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/predicate"
	"zudomart/modules/catalog/src/generated/ent/sellerapplication"
	applicationservices "zudomart/modules/catalog/src/modules/sellerApplications/services"
	"zudomart/modules/catalog/src/utils"
	"zudomart/platform/httpserver"
)

type Query struct {
	Status string
	Search string
	Cursor string
	Limit  int
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[applicationservices.ProgramApplication], error) {
	empty := httpserver.CursorPage[applicationservices.ProgramApplication]{}
	conditions := []predicate.SellerApplication{}
	switch status := strings.ToLower(query.Status); status {
	case "", "pending":
		conditions = append(conditions, sellerapplication.Status("pending"))
	case "approved", "rejected":
		conditions = append(conditions, sellerapplication.Status(status))
	case "all":
	default:
		return empty, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "must be PENDING, APPROVED, REJECTED or ALL"}})
	}
	if text := strings.TrimSpace(query.Search); text != "" {
		conditions = append(conditions, sellerapplication.StoreNameContainsFold(text))
	}
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, sellerapplication.IDGT(*after))
	}
	rows, err := handler.Container.Client.SellerApplication.Query().Where(conditions...).Order(ent.Asc(sellerapplication.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = utils.IdentifierCursor(rows[len(rows)-1].ID)
	}
	return httpserver.NewCursorPage(applicationservices.Present(ctx, handler.Container, rows), nextCursor), nil
}
