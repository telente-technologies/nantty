package controllers_test

import (
	"testing"
	"time"

	"nantty/modules/subscriptions/src/modules/billing/controllers"
	"nantty/modules/subscriptions/src/modules/billing/dtos"
)

func TestValidatePriceRowRequiresReasonAndNonRetroactiveEffectiveDate(t *testing.T) {
	now := time.Date(2026, time.October, 29, 12, 0, 0, 0, time.UTC)
	valid := dtos.PriceRowRequestDto{Currency: "NGN", MonthlyAmountMinor: 250_000, Reason: "Approved pricing update", EffectiveFrom: now.Add(time.Hour)}
	if err := controllers.ValidatePriceRow("blue", "NG", valid, now); err != nil {
		t.Fatalf("valid scheduled price was rejected: %v", err)
	}

	valid.EffectiveFrom = now.Add(-time.Minute)
	if err := controllers.ValidatePriceRow("blue", "NG", valid, now); err == nil {
		t.Fatal("retroactive price change was accepted")
	}

	valid.EffectiveFrom = now.Add(time.Hour)
	valid.Reason = "no"
	if err := controllers.ValidatePriceRow("blue", "NG", valid, now); err == nil {
		t.Fatal("price change without a meaningful reason was accepted")
	}

	blackValid := dtos.PriceRowRequestDto{Currency: "USD", MonthlyAmountMinor: 30_000, YearlyAmountMinor: 0, Reason: "Black NG monthly pricing", EffectiveFrom: now.Add(time.Hour)}
	if err := controllers.ValidatePriceRow("black", "NG", blackValid, now); err != nil {
		t.Fatalf("valid black USD price was rejected: %v", err)
	}
	blackAnnual := blackValid
	blackAnnual.YearlyAmountMinor = 300_000
	if err := controllers.ValidatePriceRow("black", "NG", blackAnnual, now); err == nil {
		t.Fatal("black annual price must be rejected")
	}
}

func TestValidatePriceRowAllowsAdminManagedBlackUsdPriceInEveryRegion(t *testing.T) {
	now := time.Date(2026, time.November, 16, 12, 0, 0, 0, time.UTC)
	for _, country := range []string{"NG", "GH", "KE", "ZA", "GB", "EU", "US"} {
		t.Run(country, func(t *testing.T) {
			amount := int64(50_000)
			if country == "NG" {
				amount = 30_000
			}
			request := dtos.PriceRowRequestDto{
				Currency: "USD", MonthlyAmountMinor: amount, Reason: "Owner-approved admin price update", EffectiveFrom: now.Add(time.Hour),
			}
			if err := controllers.ValidatePriceRow("black", country, request, now); err != nil {
				t.Fatalf("admin-managed USD Black price rejected for %s: %v", country, err)
			}
		})
	}

	invalidCurrency := dtos.PriceRowRequestDto{Currency: "NGN", MonthlyAmountMinor: 30_000, Reason: "Invalid currency regression", EffectiveFrom: now.Add(time.Hour)}
	if err := controllers.ValidatePriceRow("black", "NG", invalidCurrency, now); err == nil {
		t.Fatal("non-USD Black price was accepted")
	}
}
