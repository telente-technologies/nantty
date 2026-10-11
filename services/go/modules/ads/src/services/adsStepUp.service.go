package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/interfaces"
	"zudomart/platform/jwtauth"
	"zudomart/platform/regionpricing"
)

const DefaultAdsStepUpAboveNgnMinor = 5_000_000

func (pricing *RegionalAdPricing) AdsStepUpThreshold(ctx context.Context, currency string) int64 {
	currency = strings.ToUpper(currency)
	base := int64(DefaultAdsStepUpAboveNgnMinor)
	if pricing != nil && pricing.Settings != nil {
		if raw, found := pricing.Settings.ReadValue(ctx, PaymentLimitsSettingKey); found {
			var stored struct {
				Base struct {
					AdsStepUpAbove int64 `json:"adsStepUpAbove"`
				} `json:"baseMinor"`
				Overrides map[string]struct {
					AdsStepUpAbove int64 `json:"adsStepUpAbove"`
				} `json:"currencyOverridesMinor"`
			}
			if json.Unmarshal(raw, &stored) == nil {
				if override, set := stored.Overrides[currency]; set && override.AdsStepUpAbove > 0 {
					return override.AdsStepUpAbove
				}
				if stored.Base.AdsStepUpAbove > 0 {
					base = stored.Base.AdsStepUpAbove
				}
			}
		}
	}
	return regionpricing.ConvertLimitFromBaseCurrency(base, currency, pricing.rates(ctx))
}

type AdsStepUpGate struct {
	Pricing  *RegionalAdPricing
	Verifier *jwtauth.AccessTokenVerifier
	StepUps  interfaces.StepUpConsumer
}

func (gate AdsStepUpGate) RequireAbove(request *http.Request, amountMinor int64, currency string) error {
	ctx := request.Context()
	threshold := gate.Pricing.AdsStepUpThreshold(ctx, currency)
	if amountMinor <= threshold {
		return nil
	}
	required := adserrors.AdsStepUpRequired.WithDetails(map[string]any{"stepUpAbove": map[string]any{"amountMinor": threshold, "currency": strings.ToUpper(currency)}})
	principal, found := jwtauth.PrincipalFromContext(ctx)
	token := strings.TrimSpace(request.Header.Get(jwtauth.UserStepUpHeader))
	if !found || token == "" || gate.Verifier == nil || !jwtauth.VerifyUserStepUp(ctx, gate.Verifier, request, principal) {
		return required
	}
	if gate.StepUps == nil {
		return adserrors.UpstreamUnavailable
	}
	digest := sha256.Sum256([]byte(token))
	route := request.Method + " " + request.URL.Path
	if len(route) > 200 {
		route = route[:200]
	}
	return gate.StepUps.ConsumeStepUp(ctx, hex.EncodeToString(digest[:]), principal.UserId, route)
}
