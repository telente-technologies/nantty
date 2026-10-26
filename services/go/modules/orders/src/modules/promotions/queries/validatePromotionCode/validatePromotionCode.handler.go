package validatepromotioncode

import (
	"context"
	"strings"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/promotion"
	"nantty/modules/orders/src/modules/promotions/dtos"
	"nantty/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.ValidatedCodeView, error) {
	row, err := handler.Container.Client.Promotion.Query().Where(promotion.StoreID(query.Store.StoreId), promotion.Kind("coupon"), promotion.Code(strings.ToUpper(query.Code))).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.ValidatedCodeView{}, services.CouponNotFound()
	}
	if err != nil {
		return dtos.ValidatedCodeView{}, err
	}
	rule := services.RuleOf(row)
	if err := services.CheckPromotionApplicable(rule, handler.Container.Now(), query.SubtotalMinor, 0); err != nil {
		return dtos.ValidatedCodeView{}, err
	}
	view := services.PromotionView(row, query.Store.Currency, handler.Container.Now())
	discount := services.DiscountMinor(rule, []services.DiscountLine{{TotalMinor: query.SubtotalMinor}})
	if rule.ScopeKind != "all" {
		discount = 0
	}
	return dtos.ValidatedCodeView{PromotionId: view.Id, Code: rule.Code, Discount: view.Discount, Scope: view.Scope, DiscountMinor: discount, Message: "Code is valid"}, nil
}
