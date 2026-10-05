package listadvertisers

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccount"
	"zudomart/modules/ads/src/generated/ent/predicate"
	"zudomart/modules/ads/src/modules/adReview/dtos"
	"zudomart/modules/ads/src/modules/adReview/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.PagedList[dtos.Advertiser], error) {
	var filters []predicate.AdAccount
	switch query.Status {
	case "SUSPENDED":
		filters = append(filters, adaccount.StatusEQ(adaccount.StatusDisabled))
	case "ACTIVE":
		filters = append(filters, adaccount.StatusNEQ(adaccount.StatusDisabled))
	}
	if query.Search != "" {
		filters = append(filters, adaccount.NameContainsFold(query.Search))
	}
	client := handler.Container.Client
	total, err := client.AdAccount.Query().Where(filters...).Count(ctx)
	if err != nil {
		return dtos.PagedList[dtos.Advertiser]{}, err
	}
	rows, err := client.AdAccount.Query().Where(filters...).Order(ent.Desc(adaccount.FieldViolationCount), ent.Desc(adaccount.FieldCreatedAt)).Offset((query.Page - 1) * query.PageSize).Limit(query.PageSize).All(ctx)
	if err != nil {
		return dtos.PagedList[dtos.Advertiser]{}, err
	}
	items, err := services.PresentAdvertisers(ctx, handler.Container, rows)
	if err != nil {
		return dtos.PagedList[dtos.Advertiser]{}, err
	}
	return dtos.PagedList[dtos.Advertiser]{Data: items, Page: query.Page, PageSize: query.PageSize, Total: total}, nil
}
