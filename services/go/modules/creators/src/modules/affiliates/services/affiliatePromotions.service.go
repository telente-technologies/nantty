package services

import (
	"context"
	"sort"

	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/affiliateattributedsale"
	"zudomart/modules/creators/src/generated/ent/affiliatecommission"
	"zudomart/modules/creators/src/generated/ent/affiliatelink"
	"zudomart/modules/creators/src/generated/ent/affiliateproductcommission"
	"zudomart/modules/creators/src/repositories"
)

const maximumPromotionRows = 2000

type PromotionView struct {
	ProductId         string                    `json:"productId"`
	Name              string                    `json:"name"`
	ImageUrl          *string                   `json:"imageUrl"`
	Price             Money                     `json:"price"`
	Stock             *int64                    `json:"stock"`
	Store             repositories.StoreSummary `json:"store"`
	CommissionPercent float64                   `json:"commissionPercent"`
	Access            string                    `json:"access"`
	Link              *AffiliateLinkView        `json:"link"`
	Clicks            int64                     `json:"clicks"`
	PendingOrders     int                       `json:"pendingOrders"`
	CompletedOrders   int                       `json:"completedOrders"`
	ReversedOrders    int                       `json:"reversedOrders"`
	ConversionPercent *float64                  `json:"conversionPercent"`
	Sales             Money                     `json:"sales"`
	Earned            Money                     `json:"earned"`
	PendingEarnings   Money                     `json:"pendingEarnings"`
	Programme         *ProgrammeTermsView       `json:"programme"`
}

func (affiliates Affiliates) ListPromotions(ctx context.Context, creatorId string) ([]PromotionView, error) {
	client := affiliates.Container.Client(affiliates.Container.Resources.Database)
	links, err := client.AffiliateLink.Query().Where(affiliatelink.CreatorID(creatorId)).Order(ent.Desc(affiliatelink.FieldID)).Limit(maximumPromotionRows).All(ctx)
	if err != nil {
		return nil, err
	}
	commissions, err := client.AffiliateCommission.Query().Where(affiliatecommission.CreatorID(creatorId)).Order(ent.Desc(affiliatecommission.FieldID)).Limit(maximumPromotionRows).All(ctx)
	if err != nil {
		return nil, err
	}
	sales, err := client.AffiliateAttributedSale.Query().Where(affiliateattributedsale.CreatorID(creatorId), affiliateattributedsale.StatusIn(affiliateattributedsale.StatusAwaiting, affiliateattributedsale.StatusVoided)).
		Order(ent.Desc(affiliateattributedsale.FieldID)).Limit(maximumPromotionRows).All(ctx)
	if err != nil {
		return nil, err
	}
	rows, order := map[string]*PromotionView{}, []string{}
	row := func(productId, storeId string) *PromotionView {
		if existing, found := rows[productId]; found {
			return existing
		}
		rows[productId] = &PromotionView{ProductId: productId, Store: repositories.StoreSummary{Id: storeId}}
		order = append(order, productId)
		return rows[productId]
	}
	for _, link := range links {
		view := presentLink(link)
		promotion := row(link.ProductID, link.StoreID)
		promotion.Link, promotion.Clicks = &view, link.Clicks
	}
	for _, commission := range commissions {
		promotion := row(commission.ProductID, commission.StoreID)
		promotion.Name = firstNonEmpty(promotion.Name, commission.ProductName)
		if commission.Status == affiliatecommission.StatusReversed {
			promotion.ReversedOrders++
			continue
		}
		promotion.CompletedOrders++
		promotion.Sales = addMoney(promotion.Sales, commission.SaleMinor, commission.Currency)
		promotion.Earned = addMoney(promotion.Earned, commission.CommissionMinor-commission.ReversedMinor, commission.Currency)
	}
	for _, sale := range sales {
		promotion := row(sale.ProductID, sale.StoreID)
		promotion.Name = firstNonEmpty(promotion.Name, sale.ProductName)
		if sale.Status == affiliateattributedsale.StatusVoided {
			promotion.ReversedOrders++
			continue
		}
		promotion.PendingOrders++
		promotion.PendingEarnings = addMoney(promotion.PendingEarnings, sale.EstimatedCommissionMinor, sale.Currency)
	}
	if err := affiliates.decoratePromotions(ctx, client, creatorId, rows, order); err != nil {
		return nil, err
	}
	views := make([]PromotionView, 0, len(order))
	for _, productId := range order {
		views = append(views, *rows[productId])
	}
	sort.SliceStable(views, func(left, right int) bool {
		if views[left].Earned.AmountMinor != views[right].Earned.AmountMinor {
			return views[left].Earned.AmountMinor > views[right].Earned.AmountMinor
		}
		return views[left].Clicks > views[right].Clicks
	})
	return views, nil
}

func (affiliates Affiliates) decoratePromotions(ctx context.Context, client *ent.Client, creatorId string, rows map[string]*PromotionView, order []string) error {
	products, err := affiliates.Container.Directory.FindPromotableProducts(ctx, order)
	if err != nil {
		return err
	}
	programmes, _, err := affiliates.loadCreatorProgrammes(ctx, client, creatorId, "")
	if err != nil {
		return err
	}
	overrides, err := client.AffiliateProductCommission.Query().Where(affiliateproductcommission.ProductIDIn(order...)).All(ctx)
	if err != nil {
		return err
	}
	byProduct := map[string]*ent.AffiliateProductCommission{}
	for _, override := range overrides {
		byProduct[override.StoreID+":"+override.ProductID] = override
	}
	for _, productId := range order {
		promotion := rows[productId]
		if product, found := products[productId]; found {
			promotion.Name, promotion.ImageUrl, promotion.Price, promotion.Stock = product.Name, product.ImageUrl, Money{product.PriceMinor, product.Currency}, product.Stock
			promotion.Store.Id = product.StoreId
		}
		if store, found := programmes.stores[promotion.Store.Id]; found {
			promotion.Store = store
		}
		currency := firstNonEmpty(promotion.Price.Currency, promotion.Earned.Currency, promotion.PendingEarnings.Currency, promotion.Sales.Currency)
		promotion.Sales.Currency, promotion.Earned.Currency, promotion.PendingEarnings.Currency = currency, currency, currency
		promotion.Access = programmes.accessFor(promotion.Store.Id, productId)
		if settings := programmes.settings[promotion.Store.Id]; settings != nil {
			terms := programmeTerms(settings, affiliates.MaximumBps())
			promotion.Programme = &terms
			promotion.CommissionPercent = float64(EffectiveBps(settings.DefaultCommissionBps, byProduct[promotion.Store.Id+":"+productId], affiliates.MaximumBps())) / 100
		}
		if promotion.Clicks > 0 {
			conversion := float64(promotion.PendingOrders+promotion.CompletedOrders) * 100 / float64(promotion.Clicks)
			promotion.ConversionPercent = &conversion
		}
	}
	return nil
}

func addMoney(total Money, amountMinor int64, currency string) Money {
	return Money{total.AmountMinor + amountMinor, firstNonEmpty(total.Currency, currency)}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
