package services

import (
	"context"
	"strconv"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/utils"
)

type CampaignProduct struct {
	ProductId         uuid.UUID
	Name              string
	ImageUrl          *string
	RegularPriceMinor int64
	Currency          string
	Purchasable       bool
}

func LoadCampaignProducts(ctx context.Context, deployed *container.Container, storeId uuid.UUID, productIds []uuid.UUID) (map[uuid.UUID]CampaignProduct, error) {
	catalog, err := deployed.Catalog()
	if err != nil {
		return nil, err
	}
	products := map[uuid.UUID]CampaignProduct{}
	for _, productId := range productIds {
		variants, err := catalog.ListVariantsOfProduct(ctx, productId)
		if err != nil {
			return nil, err
		}
		for _, variant := range variants {
			if variant.StoreId != storeId {
				continue
			}
			current, seen := products[productId]
			if !seen || variant.UnitPrice.AmountMinor < current.RegularPriceMinor {
				image := variant.ImageUrl
				current = CampaignProduct{ProductId: productId, Name: variant.ProductTitle, RegularPriceMinor: variant.UnitPrice.AmountMinor, Currency: string(variant.UnitPrice.Currency), Purchasable: variant.Purchasable}
				if image != "" {
					current.ImageUrl = &image
				}
			}
			products[productId] = current
		}
	}
	return products, nil
}

func RequirePurchasableCampaignProducts(products map[uuid.UUID]CampaignProduct, productIds []uuid.UUID) error {
	var collected utils.Issues
	for index, productId := range productIds {
		if product, found := products[productId]; !found || !product.Purchasable {
			collected.Add("items."+strconv.Itoa(index)+".productId", "must be an active product of this store")
		}
	}
	return collected.AsError()
}
