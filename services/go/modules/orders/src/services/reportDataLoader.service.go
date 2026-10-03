package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/platform/money"
)

func LoadReportData(ctx context.Context, deployed *container.Container, storeId uuid.UUID, currency money.CurrencyCode, from, to time.Time) (ReportData, error) {
	groups, err := deployed.Client.OrderGroup.Query().Where(ordergroup.StoreID(storeId), ordergroup.PaymentStatusNEQ(enums.PaymentPending),
		ordergroup.CreatedAtGTE(from), ordergroup.CreatedAtLT(to.AddDate(0, 0, 1))).Order(ent.Asc(ordergroup.FieldID)).All(ctx)
	if err != nil {
		return ReportData{}, err
	}
	items, err := LoadItemsByGroup(ctx, deployed, UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.ID }))
	if err != nil {
		return ReportData{}, err
	}
	return ReportData{Currency: currency, From: from, To: to, Groups: groups, Items: items, Now: deployed.Now()}, nil
}
