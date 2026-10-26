package services

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/platform/commerceports"
)

type ReportRequest struct {
	Store      commerceports.StoreAccess
	ActorId    uuid.UUID
	Kind       string
	From       time.Time
	To         time.Time
	LocationId *uuid.UUID
}

func ProduceReport(ctx context.Context, deployed *container.Container, request ReportRequest) (ReportResult, error) {
	if !slices.Contains(ReportKinds, request.Kind) {
		return ReportResult{}, ordererrors.ReportNotFound
	}
	scope := ReportScope{StoreId: request.Store.StoreId, Currency: request.Store.Currency, Kind: request.Kind, From: request.From, To: request.To, LocationId: request.LocationId}
	if !slices.Contains(LocationReportKinds, request.Kind) {
		scope.LocationId = nil
	}
	data := ReportData{Currency: request.Store.Currency, From: request.From, To: request.To, Now: deployed.Now()}
	if slices.Contains(OrderReportKinds, request.Kind) || request.Kind == "slow-sellers" {
		loaded, err := LoadReportData(ctx, deployed, scope)
		if err != nil {
			return ReportResult{}, err
		}
		data = loaded
	}
	if result, built := BuildReport(request.Kind, data); built {
		return result, nil
	}
	return produceSourcedReport(ctx, deployed, request, scope.LocationId, data)
}

func produceSourcedReport(ctx context.Context, deployed *container.Container, request ReportRequest, locationId *uuid.UUID, data ReportData) (ReportResult, error) {
	switch request.Kind {
	case "settlements":
		return settlementsReport(ctx, deployed, data, request.Store, request.ActorId)
	case "fees":
		return feesReport(ctx, deployed, data, request.Store, request.ActorId)
	case "refunds":
		return refundsReport(ctx, deployed, data, request.Store, request.ActorId)
	case "payouts":
		return payoutsReport(ctx, deployed, data, request.Store, request.ActorId)
	case "ads-campaigns":
		return adsCampaignsReport(ctx, deployed, data, request.Store)
	}
	stock, err := loadStoreStock(ctx, deployed, request.Store.StoreId)
	if err != nil {
		return ReportResult{}, err
	}
	switch request.Kind {
	case "inventory-valuation":
		return inventoryValuation(data, stock, locationId), nil
	case "low-stock":
		return lowStock(data, stock, locationId), nil
	}
	return slowSellers(data, stock, productCategories(ctx, request.Store.StoreId)), nil
}

func productCategories(ctx context.Context, storeId uuid.UUID) map[uuid.UUID]string {
	categories := map[uuid.UUID]string{}
	reader, err := commerceports.Default.StoreInsightsReader()
	if err != nil {
		return categories
	}
	cards, err := reader.DescribeStoreProducts(ctx, storeId, true)
	if err != nil {
		return categories
	}
	for productId, card := range cards {
		categories[productId] = card.CategoryName
	}
	return categories
}
