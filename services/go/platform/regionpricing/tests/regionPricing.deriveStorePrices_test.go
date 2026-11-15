package regionpricing_test

import (
	. "nantty/platform/regionpricing"
	"testing"
)

func TestDeriveStorePricesUsesWebPriceAndCurrentStoreFees(t *testing.T) {
	fees := StoreFeeSettings{AppleFeeBps: 3_000, GoogleSubscriptionFeeBps: 1_500}
	price := PlanRegionalPrice{PlanCode: "seller_business", Currency: "NGN", WebMonthlyMinor: 3_000_000, WebYearlyMinor: 28_800_000}

	got := DeriveStorePrices(price, fees, DefaultYearlyDiscountBps)
	if got.IosMonthlyMinor != GrossUpForStoreFee(price.WebMonthlyMinor, fees.AppleFeeBps, price.Currency) {
		t.Fatalf("iOS monthly = %d", got.IosMonthlyMinor)
	}
	if got.AndroidMonthlyMinor != GrossUpForStoreFee(price.WebMonthlyMinor, fees.GoogleSubscriptionFeeBps, price.Currency) {
		t.Fatalf("Android monthly = %d", got.AndroidMonthlyMinor)
	}
	if got.IosYearlyMinor != GrossUpForStoreFee(price.WebYearlyMinor, fees.AppleFeeBps, price.Currency) ||
		got.AndroidYearlyMinor != GrossUpForStoreFee(price.WebYearlyMinor, fees.GoogleSubscriptionFeeBps, price.Currency) {
		t.Fatalf("yearly store amounts did not derive from web yearly price: %+v", got)
	}
	if got.IosMonthlyMinor <= got.WebMonthlyMinor || got.AndroidMonthlyMinor <= got.WebMonthlyMinor {
		t.Fatalf("store prices should gross up the web net target: %+v", got)
	}
}

func TestDeriveStorePricesUsesConfiguredAnnualDiscountWhenWebAnnualIsMissing(t *testing.T) {
	price := PlanRegionalPrice{PlanCode: "seller_pro", Currency: "NGN", WebMonthlyMinor: 1_000_000}
	fees := StoreFeeSettings{AppleFeeBps: 0, GoogleSubscriptionFeeBps: 0}

	got := DeriveStorePrices(price, fees, 2_000)
	want := YearlyFromMonthly(price.WebMonthlyMinor, 2_000, price.Currency)
	if got.IosYearlyMinor != want || got.AndroidYearlyMinor != want {
		t.Fatalf("derived annual prices = %d/%d, want %d", got.IosYearlyMinor, got.AndroidYearlyMinor, want)
	}
}

func TestDeriveStorePricesDoesNotChangeWebOnlyPlans(t *testing.T) {
	price := PlanRegionalPrice{PlanCode: "black", Currency: "USD", WebMonthlyMinor: 30_000, IosMonthlyMinor: 0, AndroidMonthlyMinor: 0}
	got := DeriveStorePrices(price, DefaultStoreFeeSettings(), DefaultYearlyDiscountBps)
	if got.IosMonthlyMinor != 0 || got.AndroidMonthlyMinor != 0 {
		t.Fatalf("web-only plan acquired store pricing: %+v", got)
	}
}
