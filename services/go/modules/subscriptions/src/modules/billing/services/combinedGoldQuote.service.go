package services

import (
	"context"
	"net/http"
	"slices"

	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/models"
	"zudomart/modules/subscriptions/src/repositories"
	"zudomart/platform/httpserver"
	"zudomart/platform/regionpricing"
)

var (
	ErrPremiumRequired              = httpserver.NewApiError(http.StatusForbidden, "PREMIUM_REQUIRED", "Gold for all your businesses comes with Blue Premium. Get Premium to use it.")
	ErrCombinedGoldProfilesInvalid  = httpserver.NewApiError(http.StatusUnprocessableEntity, "COMBINED_GOLD_PROFILES_INVALID", "Choose business profiles you own.")
	ErrCombinedGoldTooManyProfiles  = httpserver.NewApiError(http.StatusUnprocessableEntity, "COMBINED_GOLD_TOO_MANY_PROFILES", "This plan covers up to 5 business profiles.")
	ErrCombinedGoldProfileHasGold   = httpserver.NewApiError(http.StatusConflict, "PROFILE_ALREADY_HAS_GOLD", "One of these businesses already has its own Gold plan. Cancel it first, then add it here.")
	ErrProfileCoveredByCombinedGold = httpserver.NewApiError(http.StatusConflict, "PROFILE_COVERED_BY_COMBINED_GOLD", "This business already has Gold through Gold for all your businesses.")
	ErrCombinedGoldPriceChanged     = httpserver.NewApiError(http.StatusConflict, "PRICE_CHANGED", "The price changed. Check the new total and try again.")
	ErrUseCombinedGoldCheckout      = httpserver.NewApiError(http.StatusUnprocessableEntity, "USE_COMBINED_GOLD_CHECKOUT", "Buy Gold for all your businesses from the plans page.")
)

type CombinedGoldProfileShare struct {
	ProfileId   string         `json:"profileId"`
	DisplayName string         `json:"displayName"`
	ProfileType string         `json:"profileType"`
	Price       map[string]any `json:"price"`
}

type CombinedGoldQuoteView struct {
	Interval    string                     `json:"interval"`
	Currency    string                     `json:"currency"`
	Region      string                     `json:"region"`
	Breakdown   models.CombinedGoldQuote   `json:"breakdown"`
	Discount    models.PriceQuote          `json:"discount"`
	Total       map[string]any             `json:"total"`
	ListTotal   map[string]any             `json:"listTotal"`
	UnitPrice   map[string]any             `json:"unitMonthlyPrice"`
	Profiles    []CombinedGoldProfileShare `json:"profiles"`
	LineItems   []models.LineItem          `json:"lineItems"`
	CanBuyOnWeb bool                       `json:"canBuyOnWeb"`
	BillingNote string                     `json:"billingNote,omitempty"`
	Offer       *CheckoutOfferSummary      `json:"offer,omitempty"`
}

type combinedGoldPricing struct {
	Quote    models.CombinedGoldQuote
	Price    models.PriceQuote
	Regional regionpricing.PlanRegionalPrice
	Profiles []repositories.BillingProfile
	Offer    *checkoutOffer
}

func (billing Billing) ownerHasLivePremium(ctx context.Context, client *ent.Client, ownerUserId string) (bool, error) {
	return client.Subscription.Query().Where(subscription.OwnerUserID(ownerUserId), subscription.PlanCode(constants.PlanPremium), subscription.StatusIn(liveStatuses()...)).Exist(ctx)
}

func (billing Billing) combinedGoldRules(ctx context.Context) models.CombinedGoldRules {
	_, pricing := billing.rules(ctx)
	return pricing.CombinedGold
}

func (billing Billing) ownedBusinessProfiles(ctx context.Context, ownerUserId string) ([]repositories.BillingProfile, error) {
	lister, supported := billing.Container.Identity.(repositories.BusinessProfileLister)
	if !supported {
		return []repositories.BillingProfile{}, nil
	}
	return lister.ListBusinessProfilesOfAccount(ctx, ownerUserId)
}

func (billing Billing) resolveCombinedGoldProfiles(ctx context.Context, ownerUserId string, profileIds []string) ([]repositories.BillingProfile, error) {
	maximum := billing.combinedGoldRules(ctx).MaximumProfiles
	if len(profileIds) == 0 {
		return nil, ErrCombinedGoldProfilesInvalid
	}
	if len(profileIds) > maximum {
		return nil, ErrCombinedGoldTooManyProfiles
	}
	owned, err := billing.ownedBusinessProfiles(ctx, ownerUserId)
	if err != nil {
		return nil, err
	}
	chosen := make([]repositories.BillingProfile, 0, len(profileIds))
	for index, profileId := range profileIds {
		position := slices.IndexFunc(owned, func(profile repositories.BillingProfile) bool { return profile.ProfileId == profileId })
		if position < 0 || slices.Contains(profileIds[:index], profileId) || !PlanAllowedForProfile(constants.PlanGoldOnly, owned[position].ProfileType) {
			return nil, ErrCombinedGoldProfilesInvalid
		}
		chosen = append(chosen, owned[position])
	}
	return chosen, nil
}

func (billing Billing) priceCombinedGold(ctx context.Context, client *ent.Client, ownerUserId string, profileCount int, interval, chargingCountry string, tierAllowed bool) (models.CombinedGoldQuote, regionpricing.PlanRegionalPrice, error) {
	regional, err := billing.RegionalPriceFor(ctx, client, constants.PlanGoldOnly, chargingCountry, "web")
	if err != nil {
		return models.CombinedGoldQuote{}, regionpricing.PlanRegionalPrice{}, err
	}
	unit := regional.AmountFor("web", "month")
	if unit <= 0 {
		return models.CombinedGoldQuote{}, regional, ErrPlanNotFound
	}
	quote := models.QuoteCombinedGold(billing.combinedGoldRules(ctx), models.CombinedGoldInput{UnitMonthlyMinor: unit, ProfileCount: profileCount, Interval: interval, TierAllowed: tierAllowed})
	return quote, regional, nil
}

func (billing Billing) quoteCombinedGoldForCheckout(ctx context.Context, client *ent.Client, request CheckoutRequest, profileIds []string) (combinedGoldPricing, error) {
	premium, err := billing.ownerHasLivePremium(ctx, client, request.UserId)
	if err != nil {
		return combinedGoldPricing{}, err
	}
	if !premium {
		return combinedGoldPricing{}, ErrPremiumRequired
	}
	profiles, err := billing.resolveCombinedGoldProfiles(ctx, request.UserId, profileIds)
	if err != nil {
		return combinedGoldPricing{}, err
	}
	if request.ViewerCountry == "" {
		return combinedGoldPricing{}, regionpricing.ErrCountryRequired
	}
	quote, regional, err := billing.priceCombinedGold(ctx, client, request.UserId, len(profiles), request.Interval, request.ViewerCountry, true)
	if err != nil {
		return combinedGoldPricing{}, err
	}
	request.PlanCode = constants.PlanGoldCombined
	price, offer, err := billing.quoteWithOfferClaim(ctx, client, request, quote.AsPriceQuote(), regional.Currency)
	if err != nil {
		return combinedGoldPricing{}, err
	}
	return combinedGoldPricing{Quote: quote, Price: price, Regional: regional, Profiles: profiles, Offer: offer}, nil
}

func (billing Billing) QuoteCombinedGold(ctx context.Context, request CheckoutRequest, profileIds []string) (CombinedGoldQuoteView, error) {
	client := billing.Container.Client(billing.Container.Resources.Database)
	pricing, err := billing.quoteCombinedGoldForCheckout(ctx, client, request, profileIds)
	if err != nil {
		return CombinedGoldQuoteView{}, err
	}
	return combinedGoldQuoteViewOf(pricing, request.Interval), nil
}

func combinedGoldQuoteViewOf(pricing combinedGoldPricing, interval string) CombinedGoldQuoteView {
	currency := pricing.Regional.Currency
	charge := models.CombinedGoldCharge(pricing.Quote, pricing.Price, 0)
	shares := models.AllocateEvenly(pricing.Price.AmountMinor, len(pricing.Profiles))
	profiles := make([]CombinedGoldProfileShare, 0, len(pricing.Profiles))
	for index, profile := range pricing.Profiles {
		profiles = append(profiles, CombinedGoldProfileShare{ProfileId: profile.ProfileId, DisplayName: profile.DisplayName, ProfileType: profile.ProfileType, Price: money(shares[index], currency)})
	}
	return CombinedGoldQuoteView{
		Interval: interval, Currency: currency, Region: pricing.Regional.Region, Breakdown: pricing.Quote, Discount: pricing.Price,
		Total: money(pricing.Price.AmountMinor, currency), ListTotal: money(pricing.Price.ListAmountMinor, currency), UnitPrice: money(pricing.Quote.UnitMonthlyMinor, currency),
		Profiles: profiles, LineItems: charge.LineItems, CanBuyOnWeb: !pricing.Regional.NotChargeableOnWeb, BillingNote: webBillingNote(pricing.Regional),
		Offer: checkoutOfferSummaryOf(pricing.Offer, pricing.Price, currency),
	}
}

func PriceBookPlanOf(planCode string) string {
	if planCode == constants.PlanGoldCombined {
		return constants.PlanGoldOnly
	}
	return planCode
}

func (billing Billing) quoteForOfferPreview(ctx context.Context, client *ent.Client, ownerUserId, planCode, country, interval string) (models.PriceQuote, regionpricing.PlanRegionalPrice, error) {
	if planCode != constants.PlanGoldCombined {
		return billing.QuoteForOwnerOnChannel(ctx, client, ownerUserId, planCode, country, interval, "web")
	}
	quote, regional, err := billing.priceCombinedGold(ctx, client, ownerUserId, 1, interval, country, true)
	return quote.AsPriceQuote(), regional, err
}
