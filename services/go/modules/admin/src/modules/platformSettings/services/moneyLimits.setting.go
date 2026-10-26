package services

import (
	"encoding/json"
	"fmt"

	adminerrors "nantty/modules/admin/src/errors"
)

const (
	SellerDebtLimitsKey       = "seller.debtLimits"
	PaymentLimitsKey          = "payments.limits"
	maximumLimitMinor   int64 = 1_000_000_000_000
)

type DebtLevelAmounts struct {
	Unverified       int64 `json:"unverified"`
	PayoutVerified   int64 `json:"payoutVerified"`
	IdentityVerified int64 `json:"identityVerified"`
}

type SellerDebtLimits struct {
	Base                   DebtLevelAmounts            `json:"baseMinor"`
	OutsideNigeriaPercent  int                         `json:"outsideNigeriaPercent"`
	TrustedSellerAgeDays   int                         `json:"trustedSellerAgeDays"`
	TrustedSellerCleanDays int                         `json:"trustedSellerCleanDays"`
	CurrencyOverrides      map[string]DebtLevelAmounts `json:"currencyOverridesMinor"`
}

type WalletDailyAmounts struct {
	Basic int64 `json:"basic"`
	Mid   int64 `json:"mid"`
	Full  int64 `json:"full"`
}

type PaymentLimitAmounts struct {
	OrderCheckout  int64              `json:"orderCheckout"`
	CoinPurchase   int64              `json:"coinPurchase"`
	AdsTopUp       int64              `json:"adsTopUp"`
	AdsStepUpAbove int64              `json:"adsStepUpAbove,omitempty"`
	WalletDaily    WalletDailyAmounts `json:"walletDaily"`
}

const defaultAdsStepUpAboveMinor int64 = 5_000_000

type PaymentLimits struct {
	Base              PaymentLimitAmounts            `json:"baseMinor"`
	CurrencyOverrides map[string]PaymentLimitAmounts `json:"currencyOverridesMinor"`
}

var defaultSellerDebtLimits = SellerDebtLimits{
	Base:                  DebtLevelAmounts{Unverified: 1_000_000, PayoutVerified: 5_000_000, IdentityVerified: 20_000_000},
	OutsideNigeriaPercent: 50, TrustedSellerAgeDays: 90, TrustedSellerCleanDays: 90, CurrencyOverrides: map[string]DebtLevelAmounts{},
}

var defaultPaymentLimits = PaymentLimits{Base: PaymentLimitAmounts{
	OrderCheckout: 500_000_000, CoinPurchase: 50_000_000, AdsTopUp: 1_000_000_000, AdsStepUpAbove: defaultAdsStepUpAboveMinor,
	WalletDaily: WalletDailyAmounts{Basic: 5_000_000, Mid: 20_000_000, Full: 500_000_000},
}, CurrencyOverrides: map[string]PaymentLimitAmounts{}}

func validateSellerDebtLimits(raw json.RawMessage) (json.RawMessage, error) {
	var value SellerDebtLimits
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := validateDebtLevels("baseMinor", value.Base); err != nil {
		return nil, err
	}
	for _, check := range []error{
		requireWithin("outsideNigeriaPercent", value.OutsideNigeriaPercent, 1, 100),
		requireWithin("trustedSellerAgeDays", value.TrustedSellerAgeDays, 0, 3650),
		requireWithin("trustedSellerCleanDays", value.TrustedSellerCleanDays, 0, 3650),
	} {
		if check != nil {
			return nil, check
		}
	}
	if len(value.CurrencyOverrides) > 50 {
		return nil, adminerrors.Unprocessable("At most 50 currency overrides.")
	}
	for currency, levels := range value.CurrencyOverrides {
		if !currencyCodePattern.MatchString(currency) || currency == "NGN" {
			return nil, adminerrors.Unprocessable("Each override needs an ISO 4217 currency other than NGN.")
		}
		if err := validateDebtLevels("currencyOverridesMinor."+currency, levels); err != nil {
			return nil, err
		}
	}
	if value.CurrencyOverrides == nil {
		value.CurrencyOverrides = map[string]DebtLevelAmounts{}
	}
	return canonicalJson(value)
}

func validateDebtLevels(path string, levels DebtLevelAmounts) error {
	if err := requireAmounts(path, levels.Unverified, levels.PayoutVerified, levels.IdentityVerified); err != nil {
		return err
	}
	if levels.Unverified > levels.PayoutVerified || levels.PayoutVerified > levels.IdentityVerified {
		return adminerrors.Unprocessable(path + ": each verification level must allow at least as much as the one below it.")
	}
	return nil
}

func validatePaymentLimits(raw json.RawMessage) (json.RawMessage, error) {
	var value PaymentLimits
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if value.Base.AdsStepUpAbove == 0 {
		value.Base.AdsStepUpAbove = defaultAdsStepUpAboveMinor
	}
	if err := validatePaymentLimitAmounts("baseMinor", value.Base); err != nil {
		return nil, err
	}
	if len(value.CurrencyOverrides) > 50 {
		return nil, adminerrors.Unprocessable("At most 50 currency overrides.")
	}
	for currency, amounts := range value.CurrencyOverrides {
		if !currencyCodePattern.MatchString(currency) || currency == "NGN" {
			return nil, adminerrors.Unprocessable("Each override needs an ISO 4217 currency other than NGN.")
		}
		if err := validatePaymentLimitAmounts("currencyOverridesMinor."+currency, amounts); err != nil {
			return nil, err
		}
	}
	if value.CurrencyOverrides == nil {
		value.CurrencyOverrides = map[string]PaymentLimitAmounts{}
	}
	return canonicalJson(value)
}

func validatePaymentLimitAmounts(path string, amounts PaymentLimitAmounts) error {
	daily := amounts.WalletDaily
	if err := requireAmounts(path, amounts.OrderCheckout, amounts.CoinPurchase, amounts.AdsTopUp, daily.Basic, daily.Mid, daily.Full); err != nil {
		return err
	}
	if amounts.AdsStepUpAbove < 0 || amounts.AdsStepUpAbove > amounts.AdsTopUp {
		return adminerrors.Unprocessable(path + ".adsStepUpAbove: must be from 1 up to the ads top-up maximum (0 in an override means use the converted base).")
	}
	if daily.Basic > daily.Mid || daily.Mid > daily.Full {
		return adminerrors.Unprocessable(path + ".walletDaily: basic must not exceed mid, and mid must not exceed full.")
	}
	return nil
}

func requireAmounts(path string, amounts ...int64) error {
	for _, amount := range amounts {
		if amount <= 0 || amount > maximumLimitMinor {
			return adminerrors.Unprocessable(fmt.Sprintf("%s: every limit is a whole amount in minor units from 1 to 1,000,000,000,000.", path))
		}
	}
	return nil
}
