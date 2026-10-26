package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/modules/adminOrders/dtos"
	orderservices "nantty/modules/orders/src/services"
	"nantty/platform/money"
	"nantty/platform/usersdirectory"
)

type Directory struct {
	Profiles map[uuid.UUID]usersdirectory.ProfileName
	Stores   map[uuid.UUID]string
}

func LoadDirectory(ctx context.Context, deployed *container.Container, accountIds, storeIds []uuid.UUID) Directory {
	directory := Directory{Profiles: map[uuid.UUID]usersdirectory.ProfileName{}, Stores: map[uuid.UUID]string{}}
	if deployed.Users.Database != nil {
		if profiles, err := deployed.Users.PersonalProfilesByAccount(ctx, accountIds); err == nil {
			directory.Profiles = profiles
		}
	}
	if catalog, err := deployed.Catalog(); err == nil && len(storeIds) > 0 {
		if stores, err := catalog.DescribeStores(ctx, storeIds); err == nil {
			for storeId, store := range stores {
				directory.Stores[storeId] = store.Name
			}
		}
	}
	return directory
}

func (directory Directory) User(accountId uuid.UUID, fallbackName, fallbackHandle string) dtos.UserSummary {
	summary := dtos.UserSummary{Id: accountId.String(), Username: fallbackHandle, DisplayName: fallbackName}
	if profile, found := directory.Profiles[accountId]; found {
		summary.Username, summary.DisplayName = profile.Handle, profile.Name
		if profile.AvatarUrl != "" {
			avatar := profile.AvatarUrl
			summary.AvatarUrl = &avatar
		}
	}
	return summary
}

func DerivedEscrowStatus(group *ent.OrderGroup) string {
	switch {
	case group.PaymentStatus == enums.PaymentPending:
		return "awaiting_payment"
	case group.Status == enums.StatusDisputed:
		return "disputed"
	case group.PaymentStatus == enums.PaymentRefunded:
		return "refunded"
	case group.PaymentStatus == enums.PaymentPartiallyRefunded:
		return "partially_refunded"
	case group.Status == enums.StatusCompleted:
		return "released"
	}
	return "held"
}

func Summaries(ctx context.Context, deployed *container.Container, groups []*ent.OrderGroup) ([]dtos.OrderSummary, error) {
	accountIds := make([]uuid.UUID, 0, len(groups)*2)
	for _, group := range groups {
		accountIds = append(accountIds, group.BuyerAccountID, group.SellerAccountID)
	}
	storeIds := orderservices.UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.StoreID })
	directory := LoadDirectory(ctx, deployed, accountIds, storeIds)
	items, err := orderservices.LoadItemsByGroup(ctx, deployed, orderservices.UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.ID }))
	if err != nil {
		return nil, err
	}
	summaries := make([]dtos.OrderSummary, 0, len(groups))
	for _, group := range groups {
		summaries = append(summaries, Summary(group, items[group.ID], directory))
	}
	return summaries, nil
}

func Summary(group *ent.OrderGroup, items []*ent.OrderItem, directory Directory) dtos.OrderSummary {
	count := 0
	for _, item := range items {
		count += item.Quantity
	}
	return dtos.OrderSummary{
		Id: group.ID.String(), OrderNumber: group.Reference, InvoiceNumber: group.InvoiceNumber, Buyer: directory.User(group.BuyerAccountID, group.BuyerName, group.BuyerUsername),
		Seller: directory.User(group.SellerAccountID, "", ""), StoreId: group.StoreID.String(), StoreName: directory.Stores[group.StoreID], Status: group.Status,
		PaymentStatus: group.PaymentStatus, PaymentMode: group.PaymentMode, EscrowStatus: DerivedEscrowStatus(group), DeliveryStatus: group.DeliveryStatus,
		Total: moneyOf(group.TotalMinor, group.Currency), ItemCount: count, PlacedAt: group.CreatedAt,
	}
}

func RefundView(record *ent.RefundRecord, directory Directory) dtos.RefundRecord {
	return dtos.RefundRecord{
		Id: record.ID.String(), OrderId: record.OrderGroupID.String(), OrderNumber: record.OrderReference, StoreId: record.StoreID.String(),
		Buyer: directory.User(record.BuyerAccountID, "", ""), Amount: moneyOf(record.AmountMinor, record.Currency), Source: record.Source, Status: record.Status,
		Reason: record.Reason, CreatedAt: record.CreatedAt, CompletedAt: record.CompletedAt, CreatedByName: record.CreatedByName,
	}
}

func RefundViews(ctx context.Context, deployed *container.Container, records []*ent.RefundRecord) []dtos.RefundRecord {
	directory := LoadDirectory(ctx, deployed, orderservices.UniqueIdentifiers(records, func(record *ent.RefundRecord) uuid.UUID { return record.BuyerAccountID }), nil)
	views := make([]dtos.RefundRecord, 0, len(records))
	for _, record := range records {
		views = append(views, RefundView(record, directory))
	}
	return views
}

func moneyOf(amountMinor int64, currency string) money.Money {
	return money.Money{AmountMinor: amountMinor, Currency: money.CurrencyCode(currency)}
}
