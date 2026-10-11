package listbrandproducts

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/brand"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/store"
	brandservices "zudomart/modules/catalog/src/modules/brands/services"
	listproducts "zudomart/modules/catalog/src/modules/products/queries/listProducts"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
)

const sectionLimit = 40

type Query struct {
	BrandId uuid.UUID
	Viewer  *uuid.UUID
}

type BrandProducts struct {
	OfficialStoreProducts []types.ProductSummaryView `json:"officialStoreProducts"`
	OtherSellersProducts  []types.ProductSummaryView `json:"otherSellersProducts"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (BrandProducts, error) {
	result := BrandProducts{OfficialStoreProducts: []types.ProductSummaryView{}, OtherSellersProducts: []types.ProductSummaryView{}}
	found, err := handler.Container.Client.Brand.Query().Where(brand.ID(query.BrandId), brand.Active(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return result, catalogerrors.NotFound
	}
	if err != nil {
		return result, err
	}
	officials, err := brandservices.OfficialStores(ctx, handler.Container, []uuid.UUID{query.BrandId})
	if err != nil {
		return result, err
	}
	conditions := append(services.WithRegionCondition(listproducts.PublicListingConditions(), services.ViewerCountry(ctx, handler.Container, query.Viewer), query.Viewer), product.BrandID(query.BrandId))
	if !found.SellingEnabled {
		storefronts, err := handler.Container.Client.Store.Query().Where(store.BrandID(query.BrandId), store.Channel(enums.ChannelBrand)).IDs(ctx)
		if err != nil {
			return result, err
		}
		if len(storefronts) > 0 {
			conditions = append(conditions, product.StoreIDNotIn(storefronts...))
		}
	}
	rows, err := handler.Container.Client.Product.Query().Where(conditions...).Order(ent.Desc(product.FieldUnitsSold), ent.Desc(product.FieldID)).Limit(sectionLimit * 2).All(ctx)
	if err != nil {
		return result, err
	}
	views, err := services.LoadProductSummaries(ctx, handler.Container, rows, query.Viewer)
	if err != nil {
		return result, err
	}
	official := officials[query.BrandId]
	for index, row := range rows {
		if official != nil && row.StoreID == official.ID {
			if len(result.OfficialStoreProducts) < sectionLimit {
				result.OfficialStoreProducts = append(result.OfficialStoreProducts, views[index])
			}
		} else if len(result.OtherSellersProducts) < sectionLimit {
			result.OtherSellersProducts = append(result.OtherSellersProducts, views[index])
		}
	}
	return result, nil
}
