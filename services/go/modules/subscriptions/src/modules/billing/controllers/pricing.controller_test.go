package controllers

import (
	"testing"
	"time"

	"nantty/modules/subscriptions/src/modules/billing/dtos"
)

func TestValidatePriceRowRequiresReasonAndNonRetroactiveEffectiveDate(t *testing.T) {
	now := time.Date(2026, time.October, 29, 12, 0, 0, 0, time.UTC)
	valid := dtos.PriceRowRequestDto{Currency: "NGN", MonthlyAmountMinor: 250_000, Reason: "Approved pricing update", EffectiveFrom: now.Add(time.Hour)}
	if err := validatePriceRow("NG", valid, now); err != nil {
		t.Fatalf("valid scheduled price was rejected: %v", err)
	}

	valid.EffectiveFrom = now.Add(-time.Minute)
	if err := validatePriceRow("NG", valid, now); err == nil {
		t.Fatal("retroactive price change was accepted")
	}

	valid.EffectiveFrom = now.Add(time.Hour)
	valid.Reason = "no"
	if err := validatePriceRow("NG", valid, now); err == nil {
		t.Fatal("price change without a meaningful reason was accepted")
	}
}
