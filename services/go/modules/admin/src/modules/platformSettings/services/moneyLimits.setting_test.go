package services

import (
	"encoding/json"
	"testing"
)

func TestDefaultMoneyLimitsAreTheOwnerApprovedNumbersAndValidate(t *testing.T) {
	if base := defaultSellerDebtLimits.Base; base.Unverified != 1_000_000 || base.PayoutVerified != 5_000_000 || base.IdentityVerified != 20_000_000 || defaultSellerDebtLimits.OutsideNigeriaPercent != 50 {
		t.Fatalf("seller debt defaults must be ₦10,000 / ₦50,000 / ₦200,000 and half outside Nigeria: %+v", defaultSellerDebtLimits)
	}
	if base := defaultPaymentLimits.Base; base.OrderCheckout != 500_000_000 || base.CoinPurchase != 50_000_000 || base.AdsTopUp != 1_000_000_000 ||
		base.WalletDaily != (WalletDailyAmounts{Basic: 5_000_000, Mid: 20_000_000, Full: 500_000_000}) {
		t.Fatalf("payment defaults must be ₦5m order, ₦500k coins, ₦10m ads, wallet ₦50k/₦200k/₦5m: %+v", defaultPaymentLimits)
	}
	for key, value := range map[string]any{SellerDebtLimitsKey: defaultSellerDebtLimits, PaymentLimitsKey: defaultPaymentLimits} {
		raw, _ := json.Marshal(value)
		if _, err := PlatformSettingDefinitions[key].Validate(raw); err != nil {
			t.Fatalf("%s defaults must validate: %v", key, err)
		}
		if PlatformSettingDefinitions[key].WritePermission != "config:revenue" {
			t.Fatalf("%s is a revenue setting", key)
		}
	}
}

func TestMoneyLimitValidationRejectsInconsistentOrUnsafeValues(t *testing.T) {
	debt := `{"baseMinor":{"unverified":1000000,"payoutVerified":5000000,"identityVerified":20000000},"outsideNigeriaPercent":50,"trustedSellerAgeDays":90,"trustedSellerCleanDays":90,"currencyOverridesMinor":%s}`
	for name, input := range map[string]string{
		"levels out of order":   `{"baseMinor":{"unverified":9000000,"payoutVerified":5000000,"identityVerified":20000000},"outsideNigeriaPercent":50,"trustedSellerAgeDays":90,"trustedSellerCleanDays":90,"currencyOverridesMinor":{}}`,
		"zero limit":            `{"baseMinor":{"unverified":0,"payoutVerified":5000000,"identityVerified":20000000},"outsideNigeriaPercent":50,"trustedSellerAgeDays":90,"trustedSellerCleanDays":90,"currencyOverridesMinor":{}}`,
		"percent above 100":     `{"baseMinor":{"unverified":1,"payoutVerified":2,"identityVerified":3},"outsideNigeriaPercent":150,"trustedSellerAgeDays":90,"trustedSellerCleanDays":90,"currencyOverridesMinor":{}}`,
		"naira as override":     jsonf(debt, `{"NGN":{"unverified":1,"payoutVerified":2,"identityVerified":3}}`),
		"bad currency override": jsonf(debt, `{"ghs":{"unverified":1,"payoutVerified":2,"identityVerified":3}}`),
		"unknown field":         `{"baseMinor":{"unverified":1,"payoutVerified":2,"identityVerified":3},"outsideNigeriaPercent":50,"trustedSellerAgeDays":90,"trustedSellerCleanDays":90,"vip":1}`,
	} {
		if _, err := validateSellerDebtLimits(json.RawMessage(input)); err == nil {
			t.Errorf("seller debt %s must be refused", name)
		}
	}
	if _, err := validateSellerDebtLimits(json.RawMessage(jsonf(debt, `{"GHS":{"unverified":4000,"payoutVerified":20000,"identityVerified":80000}}`))); err != nil {
		t.Errorf("a valid GHS override was refused: %v", err)
	}
	payments := `{"baseMinor":{"orderCheckout":500000000,"coinPurchase":50000000,"adsTopUp":1000000000,"walletDaily":%s},"currencyOverridesMinor":{}}`
	if _, err := validatePaymentLimits(json.RawMessage(jsonf(payments, `{"basic":20000000,"mid":5000000,"full":500000000}`))); err == nil {
		t.Error("a basic wallet tier above mid must be refused")
	}
	if _, err := validatePaymentLimits(json.RawMessage(jsonf(payments, `{"basic":5000000,"mid":20000000,"full":2000000000000}`))); err == nil {
		t.Error("an absurd limit must be refused")
	}
}

func jsonf(format, value string) string {
	out := []byte{}
	for index := 0; index < len(format); index++ {
		if format[index] == '%' && index+1 < len(format) && format[index+1] == 's' {
			out = append(out, value...)
			index++
			continue
		}
		out = append(out, format[index])
	}
	return string(out)
}
