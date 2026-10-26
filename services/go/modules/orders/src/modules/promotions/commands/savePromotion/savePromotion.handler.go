package savepromotion

import (
	"context"
	"net/http"
	"strings"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/promotion"
	"nantty/modules/orders/src/modules/promotions/dtos"
	"nantty/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

var (
	codeTaken         = ordererrors.Api(http.StatusConflict, "COUPON_CODE_TAKEN", "That code is already used in this store.")
	promotionNotFound = ordererrors.Api(http.StatusNotFound, "PROMOTION_NOT_FOUND", "That promotion could not be found.")
)

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.PromotionView, error) {
	request := command.Request
	var saved *ent.Promotion
	var err error
	if command.PromotionId == nil {
		create := handler.Container.Client.Promotion.Create().SetStoreID(command.Store.StoreId).SetName(strings.TrimSpace(*request.Name)).SetKind(*request.Kind).
			SetDiscountKind(request.Discount.Kind).SetDiscountValue(request.Discount.Value).SetScopeKind(request.Scope.Kind).SetScopeIds(request.Scope.Ids).SetStartsAt(*request.StartsAt)
		if request.Code != nil && *request.Kind == "coupon" {
			create.SetCode(strings.ToUpper(*request.Code))
		}
		if request.MinimumSpendMinor != nil {
			create.SetNillableMinimumSpendMinor(*request.MinimumSpendMinor)
		}
		if request.UsageLimit != nil {
			create.SetNillableUsageLimit(*request.UsageLimit)
		}
		if request.UsageLimitPerCustomer != nil {
			create.SetNillableUsageLimitPerCustomer(*request.UsageLimitPerCustomer)
		}
		if request.EndsAt != nil {
			create.SetNillableEndsAt(*request.EndsAt)
		}
		saved, err = create.Save(ctx)
	} else {
		saved, err = handler.update(ctx, command)
	}
	if ent.IsConstraintError(err) {
		return dtos.PromotionView{}, codeTaken
	}
	if err != nil {
		return dtos.PromotionView{}, err
	}
	return services.PromotionView(saved, command.Store.Currency, handler.Container.Now()), nil
}

func (handler Handler) update(ctx context.Context, command Command) (*ent.Promotion, error) {
	request := command.Request
	row, err := handler.Container.Client.Promotion.Query().Where(promotion.ID(*command.PromotionId), promotion.StoreID(command.Store.StoreId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, promotionNotFound
	}
	if err != nil {
		return nil, err
	}
	update := row.Update()
	if request.Name != nil {
		update.SetName(strings.TrimSpace(*request.Name))
	}
	if request.Code != nil && row.Kind == "coupon" {
		update.SetCode(strings.ToUpper(*request.Code))
	}
	if request.Discount != nil {
		update.SetDiscountKind(request.Discount.Kind).SetDiscountValue(request.Discount.Value)
	}
	if request.Scope != nil {
		update.SetScopeKind(request.Scope.Kind).SetScopeIds(request.Scope.Ids)
	}
	if request.MinimumSpendMinor != nil {
		update.SetNillableMinimumSpendMinor(*request.MinimumSpendMinor)
		if *request.MinimumSpendMinor == nil {
			update.ClearMinimumSpendMinor()
		}
	}
	if request.UsageLimit != nil {
		update.SetNillableUsageLimit(*request.UsageLimit)
		if *request.UsageLimit == nil {
			update.ClearUsageLimit()
		}
	}
	if request.UsageLimitPerCustomer != nil {
		update.SetNillableUsageLimitPerCustomer(*request.UsageLimitPerCustomer)
		if *request.UsageLimitPerCustomer == nil {
			update.ClearUsageLimitPerCustomer()
		}
	}
	if request.StartsAt != nil {
		update.SetStartsAt(*request.StartsAt)
	}
	if request.EndsAt != nil {
		update.SetNillableEndsAt(*request.EndsAt)
		if *request.EndsAt == nil {
			update.ClearEndsAt()
		}
	}
	if request.Status != nil {
		update.SetDisabled(*request.Status == "disabled")
	}
	return update.Save(ctx)
}
