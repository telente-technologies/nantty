package services

import (
	"context"
	"database/sql"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/container"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/loaders"
	"zudomart/modules/subscriptions/src/models"
	"zudomart/platform/httpserver"
)

var (
	ErrPlanNotFound        = httpserver.NewApiError(http.StatusNotFound, "PLAN_NOT_FOUND", "This plan was not found.")
	ErrProfileNotEligible  = httpserver.NewApiError(http.StatusUnprocessableEntity, "PLAN_NOT_FOR_PROFILE", "This plan isn't available for this profile.")
	ErrProfileNotFound     = httpserver.NewApiError(http.StatusNotFound, "PROFILE_NOT_FOUND", "Profile was not found.")
	ErrSubscriptionMissing = httpserver.NewApiError(http.StatusNotFound, "SUBSCRIPTION_NOT_FOUND", "Subscription was not found.")
	ErrPlanNotSelfServe    = httpserver.NewApiError(http.StatusForbidden, "PLAN_BY_INVITATION_ONLY", "This plan is available by invitation only.")
	ErrAlreadySubscribed   = httpserver.NewApiError(http.StatusConflict, "ALREADY_SUBSCRIBED", "This profile already has this plan.")
)

type Billing struct {
	Container *container.Container
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
	definition, known := constants.Plans[planCode]
	if !known {
		return models.PriceQuote{}, "", ErrPlanNotFound
	}
	monthly, currency, err := billing.MonthlyPriceFor(ctx, executor, planCode, countryCode)
	if err != nil {
		return models.PriceQuote{}, "", err
	}
	_, pricing := billing.rules(ctx)
	hasBlue, err := billing.ownerHasLiveBlue(ctx, executor, ownerUserId)
	if err != nil {
		return models.PriceQuote{}, "", err
	}
	bundled, err := executor.Subscription.Query().Where(subscription.OwnerUserID(ownerUserId), subscription.DiscountKindEQ(subscription.DiscountKindBundle), subscription.StatusIn(liveStatuses()...)).Count(ctx)
	if err != nil {
		return models.PriceQuote{}, "", err
	}
	return models.QuotePlanPrice(pricing.Pricing, models.PricingInput{
		MonthlyAmountMinor: monthly, Interval: interval, BundleEligiblePlan: definition.BundleEligible, HasActiveBlue: hasBlue, BundledBusinessCount: bundled,
	}), currency, nil
}

func PlanAllowedForProfile(planCode, profileType string) bool {
	definition, known := constants.Plans[planCode]
	return known && slices.Contains(definition.ProfileTypes, profileType)
}

func (billing Billing) emit(ctx context.Context, transaction *sql.Tx, eventType, subject string, data map[string]any) error {
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
		"checkmark": definition.Checkmark, "sellerPlan": definition.SellerPlan, "status": status, "validUntil": isoTime(row.CurrentPeriodEndsAt),
	}
}

func mustParseUuid(value string) uuid.UUID {
	parsed, _ := uuid.Parse(value)
	return parsed
}
