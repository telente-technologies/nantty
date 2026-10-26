package getmarketingoverview

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/campaignredemption"
	"nantty/modules/orders/src/generated/ent/flashsale"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/productbundle"
	"nantty/modules/orders/src/generated/ent/promotion"
	"nantty/modules/orders/src/generated/ent/promotionredemption"
	"nantty/modules/orders/src/modules/marketingOverview/dtos"
	"nantty/modules/orders/src/services"
	"nantty/platform/money"
)

type Handler struct {
	Container *container.Container
}

func formatted(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	text := moment.UTC().Format(time.RFC3339)
	return &text
}

func campaignStatus(raw string) string {
	switch raw {
	case "active", "scheduled", "paused", "draft":
		return raw
	case "disabled":
		return "paused"
	}
	return "ended"
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.MarketingOverview, error) {
	store, now := query.Store, handler.Container.Now()
	currency := store.Currency
	since := now.AddDate(0, 0, -30)
	overview := dtos.MarketingOverview{RevenueLast30Days: money.Money{Currency: currency}, DiscountGivenLast30Days: money.Money{Currency: currency}, Campaigns: []dtos.MarketingCampaign{}}
	promotions, err := handler.Container.Client.Promotion.Query().Where(promotion.StoreID(store.StoreId)).Order(ent.Desc(promotion.FieldID)).Limit(200).All(ctx)
	if err != nil {
		return overview, err
	}
	redemptions, err := handler.Container.Client.PromotionRedemption.Query().Where(promotionredemption.PromotionIDIn(promotionIds(promotions)...)).All(ctx)
	if err != nil {
		return overview, err
	}
	orderTotals, err := handler.orderSubtotals(ctx, redemptions)
	if err != nil {
		return overview, err
	}
	perPromotion := map[uuid.UUID][2]int64{}
	for _, redemption := range redemptions {
		tally := perPromotion[redemption.PromotionID]
		tally[0]++
		tally[1] += orderTotals[redemption.OrderGroupID]
		perPromotion[redemption.PromotionID] = tally
		if !redemption.CreatedAt.Before(since) {
			overview.RedemptionsLast30Days++
			overview.RevenueLast30Days.AmountMinor += orderTotals[redemption.OrderGroupID]
			overview.DiscountGivenLast30Days.AmountMinor += redemption.DiscountMinor
		}
	}
	for _, row := range promotions {
		kind, href := "product_discount", "/marketing/discounts/"+row.ID.String()
		if row.Code != nil {
			kind = "discount_code"
		}
		start := row.StartsAt
		overview.Campaigns = append(overview.Campaigns, dtos.MarketingCampaign{Id: row.ID.String(), Kind: kind, Name: row.Name, Status: campaignStatus(services.PromotionStatus(services.RuleOf(row), now)),
			StartsAt: formatted(&start), EndsAt: formatted(row.EndsAt), Redemptions: int(perPromotion[row.ID][0]), Revenue: money.Money{AmountMinor: perPromotion[row.ID][1], Currency: currency}, Href: href})
	}
	if query.IncludesAdvancedTools {
		if err := handler.appendAdvancedCampaigns(ctx, store.StoreId, &overview, since); err != nil {
			return overview, err
		}
	}
	for _, campaign := range overview.Campaigns {
		switch campaign.Status {
		case "active":
			overview.ActiveCampaigns++
		case "scheduled":
			overview.ScheduledCampaigns++
		}
	}
	return overview, nil
}

func (handler Handler) appendAdvancedCampaigns(ctx context.Context, storeId uuid.UUID, overview *dtos.MarketingOverview, since time.Time) error {
	now := handler.Container.Now()
	sales, err := handler.Container.Client.FlashSale.Query().Where(flashsale.StoreID(storeId)).Order(ent.Desc(flashsale.FieldID)).Limit(100).All(ctx)
	if err != nil {
		return err
	}
	for _, sale := range sales {
		starts, ends := sale.StartsAt, sale.EndsAt
		overview.Campaigns = append(overview.Campaigns, dtos.MarketingCampaign{Id: sale.ID.String(), Kind: "flash_sale", Name: sale.Name, Status: campaignStatus(services.FlashSaleStatus(sale, now)),
			StartsAt: formatted(&starts), EndsAt: formatted(&ends), Reach: sale.Reach, Revenue: money.Money{AmountMinor: sale.RevenueMinor, Currency: money.CurrencyCode(sale.Currency)}, Href: "/marketing/flash-sales"})
	}
	bundles, err := handler.Container.Client.ProductBundle.Query().Where(productbundle.StoreID(storeId)).Order(ent.Desc(productbundle.FieldID)).Limit(100).All(ctx)
	if err != nil {
		return err
	}
	for _, bundle := range bundles {
		overview.Campaigns = append(overview.Campaigns, dtos.MarketingCampaign{Id: bundle.ID.String(), Kind: "bundle", Name: bundle.Name, Status: campaignStatus(bundle.Status),
			Redemptions: bundle.SoldCount, Revenue: money.Money{AmountMinor: bundle.RevenueMinor, Currency: overview.RevenueLast30Days.Currency}, Href: "/marketing/bundles"})
	}
	recent, err := handler.Container.Client.CampaignRedemption.Query().Where(campaignredemption.StoreID(storeId), campaignredemption.CreatedAtGTE(since)).All(ctx)
	if err != nil {
		return err
	}
	for _, redemption := range recent {
		overview.RedemptionsLast30Days += redemption.Units
		overview.RevenueLast30Days.AmountMinor += redemption.RevenueMinor
		overview.DiscountGivenLast30Days.AmountMinor += redemption.DiscountMinor
	}
	return nil
}

func promotionIds(rows []*ent.Promotion) []uuid.UUID {
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.ID)
	}
	return identifiers
}

func (handler Handler) orderSubtotals(ctx context.Context, redemptions []*ent.PromotionRedemption) (map[uuid.UUID]int64, error) {
	identifiers := make([]uuid.UUID, 0, len(redemptions))
	for _, redemption := range redemptions {
		identifiers = append(identifiers, redemption.OrderGroupID)
	}
	groups, err := handler.Container.Client.OrderGroup.Query().Where(ordergroup.IDIn(identifiers...)).Select(ordergroup.FieldID, ordergroup.FieldSubtotalMinor).All(ctx)
	totals := map[uuid.UUID]int64{}
	for _, group := range groups {
		totals[group.ID] = group.SubtotalMinor
	}
	return totals, err
}
