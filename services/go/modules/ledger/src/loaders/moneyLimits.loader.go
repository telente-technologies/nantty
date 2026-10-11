package loaders

import (
	"context"
	"encoding/json"
	"strings"

	"zudomart/platform/regionpricing"
)

const (
	SellerDebtLimitsSettingKey = "seller.debtLimits"
	PaymentLimitsSettingKey    = "payments.limits"
	LimitsBaseCurrency         = regionpricing.LimitsBaseCurrency
)

type DebtLevelAmounts struct {
	Unverified       int64 `json:"unverified"`
	PayoutVerified   int64 `json:"payoutVerified"`
	IdentityVerified int64 `json:"identityVerified"`
}

type SellerDebtLimits struct {
	Base                   DebtLevelAmounts            `json:"baseMinor"`
	OutsideNigeriaPercent  int64                       `json:"outsideNigeriaPercent"`
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
	OrderCheckout int64              `json:"orderCheckout"`
	CoinPurchase  int64              `json:"coinPurchase"`
	AdsTopUp      int64              `json:"adsTopUp"`
	WalletDaily   WalletDailyAmounts `json:"walletDaily"`
}

type PaymentLimits struct {
	Base              PaymentLimitAmounts            `json:"baseMinor"`
	CurrencyOverrides map[string]PaymentLimitAmounts `json:"currencyOverridesMinor"`
}

func DefaultSellerDebtLimits() SellerDebtLimits {
	return SellerDebtLimits{
		Base:                  DebtLevelAmounts{Unverified: 1_000_000, PayoutVerified: 5_000_000, IdentityVerified: 20_000_000},
		OutsideNigeriaPercent: 50, TrustedSellerAgeDays: 90, TrustedSellerCleanDays: 90, CurrencyOverrides: map[string]DebtLevelAmounts{},
	}
}

func DefaultPaymentLimits() PaymentLimits {
	return PaymentLimits{Base: PaymentLimitAmounts{
		OrderCheckout: 500_000_000, CoinPurchase: 50_000_000, AdsTopUp: 1_000_000_000,
		WalletDaily: WalletDailyAmounts{Basic: 5_000_000, Mid: 20_000_000, Full: 500_000_000},
	}, CurrencyOverrides: map[string]PaymentLimitAmounts{}}
}

func ParseSellerDebtLimitsFromEnvironment(levels string, outsidePercent int64, ageDays, cleanDays int) SellerDebtLimits {
	limits := DefaultSellerDebtLimits()
	parsed := parseNamedAmounts(levels)
	limits.Base = DebtLevelAmounts{Unverified: pick(parsed, "unverified", limits.Base.Unverified), PayoutVerified: pick(parsed, "payoutVerified", limits.Base.PayoutVerified), IdentityVerified: pick(parsed, "identityVerified", limits.Base.IdentityVerified)}
	if outsidePercent > 0 && outsidePercent <= 100 {
		limits.OutsideNigeriaPercent = outsidePercent
	}
	if ageDays > 0 {
		limits.TrustedSellerAgeDays = ageDays
	}
	if cleanDays > 0 {
		limits.TrustedSellerCleanDays = cleanDays
	}
	return limits
}

func ParsePaymentLimitsFromEnvironment(maximums, walletDaily string) PaymentLimits {
	limits := DefaultPaymentLimits()
	parsedMaximums, parsedDaily := parseNamedAmounts(maximums), parseNamedAmounts(walletDaily)
	base := limits.Base
	limits.Base = PaymentLimitAmounts{
		OrderCheckout: pick(parsedMaximums, "orderCheckout", base.OrderCheckout), CoinPurchase: pick(parsedMaximums, "coinPurchase", base.CoinPurchase), AdsTopUp: pick(parsedMaximums, "adsTopUp", base.AdsTopUp),
		WalletDaily: WalletDailyAmounts{Basic: pick(parsedDaily, "basic", base.WalletDaily.Basic), Mid: pick(parsedDaily, "mid", base.WalletDaily.Mid), Full: pick(parsedDaily, "full", base.WalletDaily.Full)},
	}
	return limits
}

func (source *PlatformSettingsSource) ReadSellerDebtLimits(ctx context.Context, environmentFallback SellerDebtLimits) SellerDebtLimits {
	if environmentFallback.Base.Unverified <= 0 {
		environmentFallback = DefaultSellerDebtLimits()
	}
	raw, found := source.ReadValue(ctx, SellerDebtLimitsSettingKey)
	var stored SellerDebtLimits
	if !found || json.Unmarshal(raw, &stored) != nil || stored.Base.Unverified <= 0 {
		return environmentFallback
	}
	if stored.CurrencyOverrides == nil {
		stored.CurrencyOverrides = map[string]DebtLevelAmounts{}
	}
	return stored
}

func (source *PlatformSettingsSource) ReadPaymentLimits(ctx context.Context, environmentFallback PaymentLimits) PaymentLimits {
	if environmentFallback.Base.OrderCheckout <= 0 {
		environmentFallback = DefaultPaymentLimits()
	}
	raw, found := source.ReadValue(ctx, PaymentLimitsSettingKey)
	var stored PaymentLimits
	if !found || json.Unmarshal(raw, &stored) != nil || stored.Base.OrderCheckout <= 0 {
		return environmentFallback
	}
	if stored.CurrencyOverrides == nil {
		stored.CurrencyOverrides = map[string]PaymentLimitAmounts{}
	}
	return stored
}

func (source *PlatformSettingsSource) UsdRatesE8(ctx context.Context) map[string]int64 {
	if source != nil && source.Rates != nil {
		if rates, err := source.Rates.LatestUsdRatesE8(ctx); err == nil && len(rates) > 0 {
			return rates
		}
	}
	return regionpricing.DefaultUsdRatesE8
}

func (limits SellerDebtLimits) AmountsIn(currency string, ratesE8 map[string]int64) DebtLevelAmounts {
	currency = strings.ToUpper(currency)
	if currency == LimitsBaseCurrency {
		return limits.Base
	}
	if override, found := limits.CurrencyOverrides[currency]; found {
		return override
	}
	share := func(amount int64) int64 {
		return ConvertLimitToCurrency(amount*limits.OutsideNigeriaPercent/100, currency, ratesE8)
	}
	return DebtLevelAmounts{Unverified: share(limits.Base.Unverified), PayoutVerified: share(limits.Base.PayoutVerified), IdentityVerified: share(limits.Base.IdentityVerified)}
}

func (amounts DebtLevelAmounts) ForLevel(level int, trusted bool) int64 {
	switch {
	case level >= 2 || trusted:
		return amounts.IdentityVerified
	case level == 1:
		return amounts.PayoutVerified
	}
	return amounts.Unverified
}

func (limits PaymentLimits) AmountsIn(currency string, ratesE8 map[string]int64) PaymentLimitAmounts {
	currency = strings.ToUpper(currency)
	if currency == LimitsBaseCurrency {
		return limits.Base
	}
	if override, found := limits.CurrencyOverrides[currency]; found {
		return override
	}
	convert := func(amount int64) int64 { return ConvertLimitToCurrency(amount, currency, ratesE8) }
	base := limits.Base
	return PaymentLimitAmounts{
		OrderCheckout: convert(base.OrderCheckout), CoinPurchase: convert(base.CoinPurchase), AdsTopUp: convert(base.AdsTopUp),
		WalletDaily: WalletDailyAmounts{Basic: convert(base.WalletDaily.Basic), Mid: convert(base.WalletDaily.Mid), Full: convert(base.WalletDaily.Full)},
	}
}

func ConvertLimitToCurrency(amountMinor int64, currency string, ratesE8 map[string]int64) int64 {
	return regionpricing.ConvertLimitFromBaseCurrency(amountMinor, currency, ratesE8)
}

func parseNamedAmounts(raw string) map[string]int64 {
	amounts := map[string]int64{}
	for _, entry := range strings.Split(raw, ",") {
		name, value, found := strings.Cut(strings.TrimSpace(entry), ":")
		var amount int64
		if found && json.Unmarshal([]byte(strings.TrimSpace(value)), &amount) == nil && amount > 0 {
			amounts[strings.TrimSpace(name)] = amount
		}
	}
	return amounts
}

func pick(values map[string]int64, name string, fallback int64) int64 {
	if value, found := values[name]; found && value > 0 {
		return value
	}
	return fallback
}
