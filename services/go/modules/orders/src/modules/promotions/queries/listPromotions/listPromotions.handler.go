package listpromotions

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/predicate"
	"nantty/modules/orders/src/generated/ent/promotion"
	"nantty/modules/orders/src/modules/promotions/dtos"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.PromotionView], error) {
	empty := httpserver.CursorPage[dtos.PromotionView]{}
	conditions := []predicate.Promotion{promotion.StoreID(query.Store.StoreId)}
	if query.Kind != "" && query.Kind != "all" {
		conditions = append(conditions, promotion.Kind(query.Kind))
	}
	if query.Text != "" {
		conditions = append(conditions, promotion.Or(promotion.NameContainsFold(query.Text), promotion.CodeContainsFold(query.Text)))
	}
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, promotion.IDLT(*after))
	}
	now := handler.Container.Now()
	collected := []*ent.Promotion{}
	for {
		batch, err := handler.Container.Client.Promotion.Query().Where(conditions...).Order(ent.Desc(promotion.FieldID)).Limit(query.Limit + 1).All(ctx)
		if err != nil {
			return empty, err
		}
		for _, row := range batch {
			if query.Status == "" || query.Status == "all" || services.PromotionStatus(services.RuleOf(row), now) == query.Status {
				collected = append(collected, row)
			}
		}
		if len(batch) <= query.Limit || len(collected) > query.Limit {
			break
		}
		conditions = append(conditions[:len(conditions):len(conditions)], promotion.IDLT(batch[query.Limit-1].ID))
	}
	return utils.PageFromOverfetchedRows(collected, query.Limit,
		func(row *ent.Promotion) dtos.PromotionView {
			return services.PromotionView(row, query.Store.Currency, now)
		},
		func(row *ent.Promotion) string { return utils.IdentifierCursor(row.ID) }), nil
}
