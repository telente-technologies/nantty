package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/flashsale"
	"nantty/modules/orders/src/generated/ent/flashsaleitem"
	"nantty/modules/orders/src/generated/ent/productbundle"
	"nantty/modules/orders/src/generated/ent/productbundleitem"
)

var ErrFlashSaleSoldOut = ordererrors.Api(409, "FLASH_SALE_SOLD_OUT", "A flash sale price in your cart just sold out. Review your cart and try again.")

func loadFlashSaleOffers(ctx context.Context, deployed *container.Container, storeId uuid.UUID, productIds []uuid.UUID, now time.Time) ([]FlashSaleOffer, error) {
	activeSaleIds, err := deployed.Client.FlashSale.Query().Where(flashsale.StoreID(storeId), flashsale.Paused(false), flashsale.EndedAtIsNil(), flashsale.StartsAtLTE(now), flashsale.EndsAtGT(now)).IDs(ctx)
	if err != nil || len(activeSaleIds) == 0 {
		return nil, err
	}
	items, err := deployed.Client.FlashSaleItem.Query().Where(flashsaleitem.FlashSaleIDIn(activeSaleIds...), flashsaleitem.ProductIDIn(productIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	offers := make([]FlashSaleOffer, 0, len(items))
	for _, item := range items {
		offer := FlashSaleOffer{FlashSaleId: item.FlashSaleID, ItemId: item.ID, ProductId: item.ProductID, SalePriceMinor: item.SalePriceMinor}
		if item.StockCap != nil {
			left := *item.StockCap - item.SoldCount
			offer.RemainingUnits = &left
		}
		offers = append(offers, offer)
	}
	return offers, nil
}

func loadBundleOffers(ctx context.Context, deployed *container.Container, storeId uuid.UUID) ([]BundleOffer, error) {
	bundles, err := deployed.Client.ProductBundle.Query().Where(productbundle.StoreID(storeId), productbundle.Status("active")).All(ctx)
	if err != nil || len(bundles) == 0 {
		return nil, err
	}
	bundleIds := make([]uuid.UUID, 0, len(bundles))
	offers := map[uuid.UUID]*BundleOffer{}
	for _, bundle := range bundles {
		bundleIds = append(bundleIds, bundle.ID)
		offers[bundle.ID] = &BundleOffer{BundleId: bundle.ID, BundlePriceMinor: bundle.BundlePriceMinor}
	}
	items, err := deployed.Client.ProductBundleItem.Query().Where(productbundleitem.BundleIDIn(bundleIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		offers[item.BundleID].Items = append(offers[item.BundleID].Items, BundleOfferItem{ProductId: item.ProductID, Quantity: item.Quantity})
	}
	result := make([]BundleOffer, 0, len(offers))
	for _, bundleId := range bundleIds {
		result = append(result, *offers[bundleId])
	}
	return result, nil
}

func PlanGroupCampaigns(ctx context.Context, deployed *container.Container, group SellerGroup) (CampaignPlan, error) {
	lines := make([]CampaignLine, 0, len(group.Lines))
	productIds := make([]uuid.UUID, 0, len(group.Lines))
	for _, line := range group.Lines {
		lines = append(lines, CampaignLine{ProductId: line.Product.ProductId, Quantity: line.Quantity, UnitPriceMinor: line.Product.UnitPrice.AmountMinor})
		productIds = append(productIds, line.Product.ProductId)
	}
	flash, err := loadFlashSaleOffers(ctx, deployed, group.StoreId, productIds, deployed.Now())
	if err != nil {
		return CampaignPlan{}, err
	}
	bundles, err := loadBundleOffers(ctx, deployed, group.StoreId)
	if err != nil {
		return CampaignPlan{}, err
	}
	return PlanCampaignDiscounts(lines, flash, bundles), nil
}

func redeemCampaigns(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, plan CampaignPlan) error {
	for _, application := range plan.Applications {
		if application.Kind == "flash_sale" {
			item, err := tx.FlashSaleItem.Query().Where(flashsaleitem.ID(application.FlashItemId)).ForUpdate().Only(ctx)
			if err != nil {
				return err
			}
			if item.StockCap != nil && item.SoldCount+application.Units > *item.StockCap {
				return ErrFlashSaleSoldOut
			}
			if err := item.Update().AddSoldCount(application.Units).Exec(ctx); err != nil {
				return err
			}
			if err := tx.FlashSale.UpdateOneID(application.CampaignId).AddRevenueMinor(application.RevenueMinor).AddReach(1).Exec(ctx); err != nil {
				return err
			}
		} else if err := tx.ProductBundle.UpdateOneID(application.CampaignId).AddSoldCount(application.Units).AddRevenueMinor(application.RevenueMinor).Exec(ctx); err != nil {
			return err
		}
		if err := tx.CampaignRedemption.Create().SetOrderGroupID(group.ID).SetStoreID(group.StoreID).SetBuyerAccountID(group.BuyerAccountID).SetCampaignKind(application.Kind).
			SetCampaignID(application.CampaignId).SetUnits(application.Units).SetDiscountMinor(application.DiscountMinor).SetRevenueMinor(application.RevenueMinor).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}
