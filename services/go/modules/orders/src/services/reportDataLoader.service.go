package services

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

type ReportScope struct {
	StoreId    uuid.UUID
	Currency   money.CurrencyCode
	Kind       string
	From       time.Time
	To         time.Time
	LocationId *uuid.UUID
}

func LoadReportData(ctx context.Context, deployed *container.Container, scope ReportScope) (ReportData, error) {
	query := deployed.Client.OrderGroup.Query().Where(ordergroup.StoreID(scope.StoreId), ordergroup.PaymentStatusNEQ(enums.PaymentPending),
		ordergroup.CreatedAtGTE(scope.From), ordergroup.CreatedAtLT(scope.To.AddDate(0, 0, 1)))
	if scope.LocationId != nil && slices.Contains(LocationReportKinds, scope.Kind) {
		query = query.Where(ordergroup.FromLocationID(*scope.LocationId))
	}
	groups, err := query.Order(ent.Asc(ordergroup.FieldID)).All(ctx)
	if err != nil {
		return ReportData{}, err
	}
	items, err := LoadItemsByGroup(ctx, deployed, UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.ID }))
	if err != nil {
		return ReportData{}, err
	}
	data := ReportData{Currency: scope.Currency, From: scope.From, To: scope.To, Groups: groups, Items: items, Now: deployed.Now()}
	switch scope.Kind {
	case "customers-new-vs-returning":
		data.FirstOrderAt, err = firstOrderTimes(ctx, deployed, scope.StoreId, UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.BuyerAccountID }))
	case "tax":
		if reader, portError := commerceports.Default.StoreTaxRatesReader(); portError == nil {
			settings, taxError := reader.TaxSettingsForStore(ctx, scope.StoreId)
			data.Tax, err = &settings, taxError
		}
	}
	return data, err
}

func firstOrderTimes(ctx context.Context, deployed *container.Container, storeId uuid.UUID, buyerIds []uuid.UUID) (map[uuid.UUID]time.Time, error) {
	firsts := map[uuid.UUID]time.Time{}
	if len(buyerIds) == 0 {
		return firsts, nil
	}
	var rows []struct {
		BuyerAccountID uuid.UUID `json:"buyer_account_id"`
		Min            time.Time `json:"min"`
	}
	err := deployed.Client.OrderGroup.Query().Where(ordergroup.StoreID(storeId), ordergroup.BuyerAccountIDIn(buyerIds...), ordergroup.PaymentStatusNEQ(enums.PaymentPending),
		ordergroup.StatusNotIn(enums.StatusCancelled, enums.StatusRefunded, enums.StatusReturned)).
		GroupBy(ordergroup.FieldBuyerAccountID).Aggregate(ent.Min(ordergroup.FieldCreatedAt)).Scan(ctx, &rows)
	for _, row := range rows {
		firsts[row.BuyerAccountID] = row.Min
	}
	return firsts, err
}
