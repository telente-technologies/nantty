package listadvertisers

import (
	"context"
	"time"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adaccount"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/predicate"
	"zudomart/modules/ads/src/modules/adReview/dtos"
	"zudomart/modules/ads/src/modules/adReview/services"
	"zudomart/modules/ads/src/types"
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
	ownerIds := make([]string, 0, len(rows))
	for _, row := range rows {
		ownerIds = append(ownerIds, row.OwnerUserID.String())
	}
	owners, err := handler.Container.Users.LookupUsers(ctx, ownerIds)
	if err != nil {
		return dtos.PagedList[dtos.Advertiser]{}, err
	}
	items := make([]dtos.Advertiser, 0, len(rows))
	for _, row := range rows {
		active, _ := client.AdCampaign.Query().Where(adcampaign.AccountID(row.ID), adcampaign.StatusEQ(adcampaign.StatusActive)).Count(ctx)
		advertiser := dtos.Advertiser{
			Id: row.ID.String(), Name: row.Name, Owner: dtos.AdvertiserRef{Id: row.OwnerUserID.String(), Name: owners[row.OwnerUserID.String()].Name, Status: "ACTIVE"}, Status: services.PresentAdvertiserRef(row).Status,
			Country: row.CountryCode, Currency: row.Currency, SpendByCurrency: []types.Money{{AmountMinor: row.AmountSpentMicros / types.MicrosPerMinorUnit, Currency: row.Currency}},
			ActiveCampaigns: active, ViolationCount: row.ViolationCount, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		}
		if row.LastViolationAt != nil {
			last := row.LastViolationAt.UTC().Format(time.RFC3339)
			advertiser.LastViolationAt = &last
		}
		items = append(items, advertiser)
	}
	return dtos.PagedList[dtos.Advertiser]{Data: items, Page: query.Page, PageSize: query.PageSize, Total: total}, nil
}
