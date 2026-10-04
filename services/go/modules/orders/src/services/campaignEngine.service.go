package services

import (
	"sort"

	"github.com/google/uuid"
)

type FlashSaleOffer struct {
	FlashSaleId    uuid.UUID
	ItemId         uuid.UUID
	ProductId      uuid.UUID
	SalePriceMinor int64
	RemainingUnits *int
}

type BundleOfferItem struct {
	ProductId uuid.UUID
	Quantity  int
}

type BundleOffer struct {
	BundleId         uuid.UUID
	BundlePriceMinor int64
	Items            []BundleOfferItem
}

type CampaignLine struct {
	ProductId      uuid.UUID
	Quantity       int
	UnitPriceMinor int64
}

type CampaignApplication struct {
	Kind          string
	CampaignId    uuid.UUID
	FlashItemId   uuid.UUID
	Units         int
	DiscountMinor int64
	RevenueMinor  int64
}

type CampaignPlan struct {
	DiscountMinor int64
	Applications  []CampaignApplication
}

func bestFlashOfferFor(line CampaignLine, offers []FlashSaleOffer) (FlashSaleOffer, int, bool) {
	var chosen FlashSaleOffer
	chosenUnits, found := 0, false
	for _, offer := range offers {
		if offer.ProductId != line.ProductId || offer.SalePriceMinor >= line.UnitPriceMinor {
			continue
		}
		units := line.Quantity
		if offer.RemainingUnits != nil {
			units = min(units, max(*offer.RemainingUnits, 0))
		}
		if units > 0 && (!found || offer.SalePriceMinor < chosen.SalePriceMinor) {
			chosen, chosenUnits, found = offer, units, true
		}
	}
	return chosen, chosenUnits, found
}

func PlanCampaignDiscounts(lines []CampaignLine, flashOffers []FlashSaleOffer, bundleOffers []BundleOffer) CampaignPlan {
	plan := CampaignPlan{Applications: []CampaignApplication{}}
	remaining, unitPrice := map[uuid.UUID]int{}, map[uuid.UUID]int64{}
	for _, line := range lines {
		offer, units, found := bestFlashOfferFor(line, flashOffers)
		remaining[line.ProductId] += line.Quantity
		unitPrice[line.ProductId] = line.UnitPriceMinor
		if !found {
			continue
		}
		remaining[line.ProductId] -= units
		discount := (line.UnitPriceMinor - offer.SalePriceMinor) * int64(units)
		plan.DiscountMinor += discount
		plan.Applications = append(plan.Applications, CampaignApplication{Kind: "flash_sale", CampaignId: offer.FlashSaleId, FlashItemId: offer.ItemId, Units: units, DiscountMinor: discount, RevenueMinor: offer.SalePriceMinor * int64(units)})
	}
	type rankedBundle struct {
		offer       BundleOffer
		perSetSaved int64
		setRegular  int64
	}
	ranked := []rankedBundle{}
	for _, offer := range bundleOffers {
		var regular int64
		for _, item := range offer.Items {
			regular += unitPrice[item.ProductId] * int64(item.Quantity)
		}
		if saved := regular - offer.BundlePriceMinor; saved > 0 && len(offer.Items) > 0 {
			ranked = append(ranked, rankedBundle{offer: offer, perSetSaved: saved, setRegular: regular})
		}
	}
	sort.SliceStable(ranked, func(left, right int) bool { return ranked[left].perSetSaved > ranked[right].perSetSaved })
	for _, candidate := range ranked {
		sets := -1
		for _, item := range candidate.offer.Items {
			available := remaining[item.ProductId] / item.Quantity
			if sets < 0 || available < sets {
				sets = available
			}
		}
		if sets <= 0 {
			continue
		}
		for _, item := range candidate.offer.Items {
			remaining[item.ProductId] -= sets * item.Quantity
		}
		discount := candidate.perSetSaved * int64(sets)
		plan.DiscountMinor += discount
		plan.Applications = append(plan.Applications, CampaignApplication{Kind: "bundle", CampaignId: candidate.offer.BundleId, Units: sets, DiscountMinor: discount, RevenueMinor: candidate.offer.BundlePriceMinor * int64(sets)})
	}
	return plan
}
