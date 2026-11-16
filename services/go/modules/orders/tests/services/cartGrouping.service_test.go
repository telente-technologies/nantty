package services_test

import (
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func lineOf(store uuid.UUID, priceMinor int64, quantity int, currency money.CurrencyCode) services.PricedCartLine {
	return services.PricedCartLine{ItemId: uuid.New(), Quantity: quantity, Product: commerceports.ProductSnapshot{
		StoreId: store, VariantId: uuid.New(), UnitPrice: money.Money{AmountMinor: priceMinor, Currency: currency},
	}}
}

func TestCartLinesGroupBySellerKeepingFirstSeenOrder(t *testing.T) {
	firstStore, secondStore := uuid.New(), uuid.New()
	groups, err := services.GroupCartLinesBySeller([]services.PricedCartLine{
		lineOf(firstStore, 1000, 2, "NGN"), lineOf(secondStore, 500, 1, "NGN"), lineOf(firstStore, 250, 4, "NGN"),
	})
	if err != nil || len(groups) != 2 {
		t.Fatalf("groups=%d err=%v", len(groups), err)
	}
	if groups[0].StoreId != firstStore || groups[0].SubtotalMinor != 3000 || len(groups[0].Lines) != 2 {
		t.Fatalf("first group wrong: %+v", groups[0])
	}
	if groups[1].StoreId != secondStore || groups[1].SubtotalMinor != 500 {
		t.Fatalf("second group wrong: %+v", groups[1])
	}
}

func TestMixedCurrenciesInOneStoreAreRejected(t *testing.T) {
	store := uuid.New()
	if _, err := services.GroupCartLinesBySeller([]services.PricedCartLine{lineOf(store, 1, 1, "NGN"), lineOf(store, 1, 1, "USD")}); err == nil {
		t.Fatal("expected a currency mismatch")
	}
}

func TestSubtotalOverflowIsReportedNotWrapped(t *testing.T) {
	if _, err := services.GroupCartLinesBySeller([]services.PricedCartLine{lineOf(uuid.New(), 1<<62, 4, "NGN")}); err == nil {
		t.Fatal("expected an overflow error")
	}
}
