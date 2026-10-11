package services

import (
	"context"
	"encoding/json"
	"strings"

	"zudomart/platform/regionpricing"
)

const (
	PaymentLimitsSettingKey        = "payments.limits"
	DefaultAdsTopUpMaximumNgnMinor = 1_000_000_000
)

func (pricing *RegionalAdPricing) AdsTopUpMaximum(ctx context.Context, currency string) int64 {
	currency = strings.ToUpper(currency)
	base := int64(DefaultAdsTopUpMaximumNgnMinor)
	if pricing != nil && pricing.Settings != nil {
		if raw, found := pricing.Settings.ReadValue(ctx, PaymentLimitsSettingKey); found {
			var stored struct {
				Base struct {
					AdsTopUp int64 `json:"adsTopUp"`
				} `json:"baseMinor"`
				Overrides map[string]struct {
					AdsTopUp int64 `json:"adsTopUp"`
				} `json:"currencyOverridesMinor"`
			}
			if json.Unmarshal(raw, &stored) == nil {
				if override, set := stored.Overrides[currency]; set && override.AdsTopUp > 0 {
					return override.AdsTopUp
				}
				if stored.Base.AdsTopUp > 0 {
					base = stored.Base.AdsTopUp
				}
			}
		}
	}
	return regionpricing.ConvertLimitFromBaseCurrency(base, currency, pricing.rates(ctx))
}
