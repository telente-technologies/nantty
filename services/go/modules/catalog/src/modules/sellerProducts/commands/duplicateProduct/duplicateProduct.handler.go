package duplicateproduct

import (
	"context"
	"strconv"
	"strings"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent/productvariant"
	"zudomart/modules/catalog/src/modules/sellerProducts/dtos"
	getsellerproduct "zudomart/modules/catalog/src/modules/sellerProducts/queries/getSellerProduct"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.SellerProductView, error) {
	source, err := (getsellerproduct.Handler{Container: handler.Container}).Execute(ctx, getsellerproduct.Query{StoreId: command.Store.StoreId, ProductId: command.ProductId})
	if err != nil {
		return types.SellerProductView{}, err
	}
	request := dtos.ProductUpsertRequest{
		Name: source.Name + " (copy)", Description: source.Description, CategoryId: source.CategoryId, Status: enums.ProductDraft, Taxable: source.Taxable,
		TrackInventory: source.TrackInventory, Tags: source.Tags, SupplierId: source.SupplierId, Visibility: &source.Visibility,
	}
	for _, option := range source.Options {
		request.Options = append(request.Options, dtos.OptionRequest{Name: option.Name, Values: option.Values})
	}
	for _, image := range source.Images {
		request.ImageMediaIds = append(request.ImageMediaIds, image.MediaId)
	}
	attributes, videos := []dtos.AttributeRequest{}, []dtos.VideoRequest{}
	for _, attribute := range source.Attributes {
		attributes = append(attributes, dtos.AttributeRequest{Name: attribute.Name, Value: attribute.Value})
	}
	for _, video := range source.Videos {
		videos = append(videos, dtos.VideoRequest{Url: video.Url, Title: video.Title})
	}
	request.Attributes, request.Videos = &attributes, &videos
	if source.Brand != nil {
		request.Brand = &dtos.BrandRequest{BrandId: source.Brand.BrandId, Relationship: source.Brand.Relationship}
	}
	for _, variant := range source.Variants {
		sku, err := handler.uniqueCopySku(ctx, command, variant.Sku)
		if err != nil {
			return types.SellerProductView{}, err
		}
		line := dtos.VariantRequest{
			OptionValues: variant.OptionValues, Sku: sku, PriceMinor: variant.Price.AmountMinor, LowStockThreshold: variant.LowStockThreshold,
			ReorderPoint: &variant.ReorderPoint, ReorderQuantity: &variant.ReorderQuantity,
		}
		for _, price := range variant.RegionalPrices {
			line.RegionalPrices = append(line.RegionalPrices, dtos.RegionalPriceRequest{Currency: price.Currency, PriceMinor: price.PriceMinor, CompareAtPriceMinor: price.CompareAtPriceMinor})
		}
		if variant.CompareAtPrice != nil {
			line.CompareAtPriceMinor = &variant.CompareAtPrice.AmountMinor
		}
		if variant.CostPrice != nil {
			line.CostPriceMinor = &variant.CostPrice.AmountMinor
		}
		request.Variants = append(request.Variants, line)
	}
	productId, err := services.WriteProduct(ctx, handler.Container, services.ProductWrite{Store: command.Store, ActorId: command.ActorId, Request: request})
	if err != nil {
		return types.SellerProductView{}, err
	}
	return (getsellerproduct.Handler{Container: handler.Container}).Execute(ctx, getsellerproduct.Query{StoreId: command.Store.StoreId, ProductId: productId})
}

func (handler Handler) uniqueCopySku(ctx context.Context, command Command, sku string) (string, error) {
	for attempt := 1; attempt < 100; attempt++ {
		candidate := sku + "-COPY"
		if attempt > 1 {
			candidate += strconv.Itoa(attempt)
		}
		taken, err := handler.Container.Client.ProductVariant.Query().Where(productvariant.StoreID(command.Store.StoreId), productvariant.SkuKey(strings.ToLower(candidate))).Exist(ctx)
		if err != nil {
			return "", err
		}
		if !taken {
			return candidate, nil
		}
	}
	return sku + "-COPY-" + strconv.Itoa(len(sku)), nil
}
