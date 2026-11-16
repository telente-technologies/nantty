package services_test

import (
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/money"
	"nantty/platform/usersdirectory"
)

func TestAssembleCartViewQuotesOnlyDeliverableSellerTotals(t *testing.T) {
	deliverableStore := uuid.New()
	blockedStore := uuid.New()
	zoneId := uuid.New()
	deliverableProfile := &services.ShippingProfileRules{
		Id:       zoneId,
		Currency: "NGN",
		Zones: []services.ShippingZoneRule{{
			Id:           zoneId,
			Name:         "Nigeria",
			Active:       true,
			Destinations: []services.ShippingDestinationRule{{CountryCode: "NG"}},
		}},
		Rules: []services.ShippingFeeRule{{Id: uuid.New(), ZoneId: zoneId, FeeMinor: 250, Active: true}},
	}
	groups := []services.SellerGroup{
		cartGroupForTest(deliverableStore, 10_000),
		cartGroupForTest(blockedStore, 20_000),
	}
	loaded := services.CartViewContext{
		Stores: map[uuid.UUID]commerceports.StoreSnapshot{
			deliverableStore: {StoreId: deliverableStore, Name: "Deliverable Store"},
			blockedStore:     {StoreId: blockedStore, Name: "Blocked Store"},
		},
		Profiles: map[uuid.UUID]*services.ShippingProfileRules{deliverableStore: deliverableProfile},
		Credits: map[uuid.UUID]services.CreditState{
			deliverableStore: {BalanceMinor: 1_000},
			blockedStore:     {BalanceMinor: 1_000},
		},
		Rates:     map[uuid.UUID]float64{},
		Available: map[uuid.UUID]int{},
	}
	address := &usersdirectory.ShippingAddress{CountryCode: "NG"}

	quoted := services.AssembleCartView(groups, map[uuid.UUID]bool{}, loaded, address)
	if quoted.ItemsTotal.AmountMinor != 10_000 {
		t.Fatalf("quoted item subtotal = %d, want only deliverable seller subtotal 10000", quoted.ItemsTotal.AmountMinor)
	}
	if quoted.Shipping.AmountMinor != 250 {
		t.Fatalf("quoted shipping = %d, want 250", quoted.Shipping.AmountMinor)
	}
	if quoted.StoreCredit.AmountMinor != 1_000 {
		t.Fatalf("quoted store credit = %d, want only deliverable seller credit 1000", quoted.StoreCredit.AmountMinor)
	}
	if quoted.Total.AmountMinor != 9_250 {
		t.Fatalf("quoted total = %d, want 9250", quoted.Total.AmountMinor)
	}
	if quoted.PayableGroupCount != 1 {
		t.Fatalf("payable group count = %d, want 1", quoted.PayableGroupCount)
	}

	wholeCart := services.AssembleCartView(groups, map[uuid.UUID]bool{}, loaded, nil)
	if wholeCart.ItemsTotal.AmountMinor != 30_000 || wholeCart.Total.AmountMinor != 30_000 {
		t.Fatalf("address-free cart should retain whole-basket subtotal and total: items=%d total=%d", wholeCart.ItemsTotal.AmountMinor, wholeCart.Total.AmountMinor)
	}

	unavailableId := uuid.New()
	withUnavailable := services.AssembleCartView(groups, map[uuid.UUID]bool{unavailableId: true}, loaded, address)
	if withUnavailable.UnavailableItemCount != 1 || len(withUnavailable.UnavailableItems) != 1 || withUnavailable.UnavailableItems[0].Id != unavailableId.String() {
		t.Fatalf("unavailable cart line should be exposed for removal: %+v", withUnavailable.UnavailableItems)
	}
	if withUnavailable.PayableGroupCount != 0 || withUnavailable.ItemsTotal.AmountMinor != 0 || withUnavailable.Total.AmountMinor != 0 {
		t.Fatalf("a cart with an unavailable line must not claim a payable quote: %+v", withUnavailable)
	}
}

func cartGroupForTest(storeId uuid.UUID, subtotalMinor int64) services.SellerGroup {
	return services.SellerGroup{
		StoreId:       storeId,
		SubtotalMinor: subtotalMinor,
		Currency:      money.CurrencyCode("NGN"),
		Lines: []services.PricedCartLine{{
			ItemId:   uuid.New(),
			Quantity: 1,
			Product: commerceports.ProductSnapshot{
				ProductId:    uuid.New(),
				VariantId:    uuid.New(),
				StoreId:      storeId,
				ProductTitle: "Test product",
				UnitPrice:    money.Money{AmountMinor: subtotalMinor, Currency: "NGN"},
				Purchasable:  true,
			},
		}},
	}
}
