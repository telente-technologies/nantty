package services

import (
	"context"
	"database/sql"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/container"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/loaders"
	"nantty/modules/subscriptions/src/models"
	"nantty/platform/httpserver"
	"nantty/platform/regionpricing"
)

var (
	ErrPlanNotFound        = httpserver.NewApiError(http.StatusNotFound, "PLAN_NOT_FOUND", "This plan was not found.")
	ErrProfileNotEligible  = httpserver.NewApiError(http.StatusUnprocessableEntity, "PLAN_NOT_FOR_PROFILE", "This plan isn't available for this profile.")
	ErrProfileNotFound     = httpserver.NewApiError(http.StatusNotFound, "PROFILE_NOT_FOUND", "Profile was not found.")
	ErrSubscriptionMissing = httpserver.NewApiError(http.StatusNotFound, "SUBSCRIPTION_NOT_FOUND", "Subscription was not found.")
	ErrPlanNotSelfServe    = httpserver.NewApiError(http.StatusForbidden, "PLAN_BY_INVITATION_ONLY", "This plan is available by invitation only.")
	ErrAlreadySubscribed   = httpserver.NewApiError(http.StatusConflict, "ALREADY_SUBSCRIBED", "This profile already has this plan.")
	ErrWebCurrencyDisabled = httpserver.NewApiError(http.StatusUnprocessableEntity, "WEB_CURRENCY_NOT_ENABLED", WebCurrencyNotEnabledMessage)
	ErrBlackAnnualDisabled = httpserver.NewApiError(http.StatusUnprocessableEntity, "BLACK_ANNUAL_DISABLED", "Annual billing is disabled for Black Government subscriptions.")
)

const WebCurrencyNotEnabledMessage = "Web checkout isn't available in your currency or in USD yet. Buy in the Nantty app, or try again later."

type Billing struct {
	Container *container.Container
}

func (billing Billing) table(name string) string {
	schema := ""
	if billing.Container != nil {
		schema = billing.Container.Settings.Money.DatabaseSchema
	}
	if schema == "" {
		return name
	}
	return pgx.Identifier{schema, name}.Sanitize()
}

func (billing Billing) rules(ctx context.Context) (models.TrialRules, loaders.CheckmarkPricing) {
	trialRules, yearlyBps := loaders.ReadTrialRules(ctx, billing.Container.Resources.Platform)
	return trialRules, loaders.ReadCheckmarkPricing(ctx, billing.Container.Resources.Platform, yearlyBps)
}

func liveStatuses() []subscription.Status {
	statuses := make([]subscription.Status, 0, len(constants.LiveStatuses))
	for _, status := range constants.LiveStatuses {
		statuses = append(statuses, subscription.Status(status))
	}
	return statuses
}

func (billing Billing) ownerHasLiveBlue(ctx context.Context, client *ent.Client, ownerUserId string) (bool, error) {
	return client.Subscription.Query().Where(subscription.OwnerUserID(ownerUserId), subscription.PlanCodeIn(constants.PlanBlue, constants.PlanPremium), subscription.StatusIn(liveStatuses()...)).Exist(ctx)
}

func (billing Billing) QuoteForOwner(ctx context.Context, executor *ent.Client, ownerUserId, planCode, countryCode, interval string) (models.PriceQuote, string, error) {
	quote, price, err := billing.QuoteForOwnerOnChannel(ctx, executor, ownerUserId, planCode, countryCode, interval, "web")
	return quote, price.Currency, err
}

func (billing Billing) QuoteForOwnerOnChannel(ctx context.Context, executor *ent.Client, ownerUserId, planCode, countryCode, interval, channel string) (models.PriceQuote, regionpricing.PlanRegionalPrice, error) {
	definition, known := constants.Plans[planCode]
	if !known {
		return models.PriceQuote{}, regionpricing.PlanRegionalPrice{}, ErrPlanNotFound
	}
	if definition.AnnualDisabled && interval == "year" {
		return models.PriceQuote{}, regionpricing.PlanRegionalPrice{}, ErrBlackAnnualDisabled
	}
	price, err := billing.RegionalPriceFor(ctx, executor, planCode, countryCode, channel)
	if err != nil {
		return models.PriceQuote{}, regionpricing.PlanRegionalPrice{}, err
	}
	monthly, yearly := price.AmountFor(channel, "month"), price.AmountFor(channel, "year")
	if monthly <= 0 {
		return models.PriceQuote{}, price, ErrPlanNotFound
	}
	if channel != "web" {
		amount := price.AmountFor(channel, interval)
		if amount <= 0 {
			return models.PriceQuote{}, price, ErrPlanNotFound
		}
		list := amount
		if interval == "year" {
			list = monthly * 12
		}
		quote := models.PriceQuote{ListAmountMinor: list, AmountMinor: amount, DiscountKind: "none"}
		if amount < list {
			quote.DiscountKind, quote.DiscountBps = "yearly", (list-amount)*10_000/list
		}
		return quote, price, nil
	}
	_, pricing := billing.rules(ctx)
	hasBlue, err := billing.ownerHasLiveBlue(ctx, executor, ownerUserId)
	if err != nil {
		return models.PriceQuote{}, price, err
	}
	if hasBlue {
		premium, err := billing.ownerHasLivePremium(ctx, executor, ownerUserId)
		if err != nil {
			return models.PriceQuote{}, price, err
		}
		hasBlue = !premium
	}
	bundled, err := executor.Subscription.Query().Where(subscription.OwnerUserID(ownerUserId), subscription.DiscountKindEQ(subscription.DiscountKindBundle), subscription.StatusIn(liveStatuses()...)).Count(ctx)
	if err != nil {
		return models.PriceQuote{}, price, err
	}
	return models.QuotePlanPrice(pricing.Pricing, models.PricingInput{
		MonthlyAmountMinor: monthly, YearlyAmountMinor: yearly, Interval: interval, BundleEligiblePlan: definition.BundleEligible, HasActiveBlue: hasBlue, BundledBusinessCount: bundled, DiscountsDisabled: definition.DiscountsDisabled,
	}), price, nil
}

func PlanAllowedForProfile(planCode, profileType string) bool {
	definition, known := constants.Plans[planCode]
	return known && slices.Contains(definition.ProfileTypes, profileType)
}

func (billing Billing) emit(ctx context.Context, transaction *sql.Tx, eventType, subject string, data map[string]any) error {
	if strings.HasPrefix(eventType, "entitlement.") && data["plan"] == constants.PlanGoldCombined {
		return billing.emitCombinedGoldEntitlementsInTransaction(ctx, transaction, eventType, data)
	}
	return billing.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, subject, billing.Container.Now().UTC(), data)
}

func money(amountMinor int64, currency string) map[string]any {
	return map[string]any{"amountMinor": amountMinor, "currency": currency}
}

func isoTime(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}

func entitlementData(row *ent.Subscription, status string) map[string]any {
	definition := constants.Plans[row.PlanCode]
	return map[string]any{
		"subscriptionId": row.ID.String(), "profileId": row.ProfileID, "profileType": row.ProfileType, "ownerUserId": row.OwnerUserID, "plan": row.PlanCode,
		"checkmark": definition.Checkmark, "sellerPlan": definition.SellerPlan, "status": status, "validUntil": isoTime(row.CurrentPeriodEndsAt), "channel": row.Channel.String(),
	}
}

func mustParseUuid(value string) uuid.UUID {
	parsed, _ := uuid.Parse(value)
	return parsed
}
