package services

import (
	"context"
	"time"

	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
)

type SubscriptionView struct {
	Id                string         `json:"id"`
	ProfileId         string         `json:"profileId"`
	Plan              string         `json:"plan"`
	Tier              string         `json:"tier"`
	Interval          string         `json:"interval"`
	Channel           string         `json:"channel"`
	Status            string         `json:"status"`
	Price             map[string]any `json:"price"`
	ListPrice         map[string]any `json:"listPrice"`
	DiscountKind      string         `json:"discountKind"`
	TrialEndsAt       *time.Time     `json:"trialEndsAt"`
	CurrentPeriodEnd  *time.Time     `json:"currentPeriodEnd"`
	GraceEndsAt       *time.Time     `json:"graceEndsAt"`
	CancelAtPeriodEnd bool           `json:"cancelAtPeriodEnd"`
	CardSummary       string         `json:"cardSummary"`
}

func ConvertSubscription(row *ent.Subscription) SubscriptionView {
	return SubscriptionView{
		Id: row.ID.String(), ProfileId: row.ProfileID, Plan: row.PlanCode, Tier: constants.Plans[row.PlanCode].Tier, Interval: row.Interval.String(), Channel: row.Channel.String(),
		Status: string(row.Status), Price: money(row.AmountMinor, row.Currency), ListPrice: money(row.ListAmountMinor, row.Currency), DiscountKind: string(row.DiscountKind),
		TrialEndsAt: row.TrialEndsAt, CurrentPeriodEnd: row.CurrentPeriodEndsAt, GraceEndsAt: row.GraceEndsAt, CancelAtPeriodEnd: row.CancelAtPeriodEnd, CardSummary: row.CardLabel,
	}
}

func (billing Billing) ListMySubscriptions(ctx context.Context, userId string) ([]SubscriptionView, error) {
	rows, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().Where(subscription.OwnerUserID(userId)).Order(ent.Desc(subscription.FieldCreatedAt)).Limit(100).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]SubscriptionView, 0, len(rows))
	for _, row := range rows {
		views = append(views, ConvertSubscription(row))
	}
	return views, nil
}

type PlanView struct {
	Id        string         `json:"id"`
	PlanCode  string         `json:"planCode"`
	Tier      string         `json:"tier"`
	Interval  string         `json:"interval"`
	Price     map[string]any `json:"price"`
	ListPrice map[string]any `json:"listPrice"`
	Discount  string         `json:"discountKind"`
	TrialDays int            `json:"trialDays"`
}

func (billing Billing) ListPlans(ctx context.Context, ownerUserId, countryCode string, planCodes []string) ([]PlanView, error) {
	client := billing.Container.Client(billing.Container.Resources.Database)
	trialRules, _ := billing.rules(ctx)
	views := []PlanView{}
	for _, code := range planCodes {
		definition := constants.Plans[code]
		if !definition.SelfServe {
			continue
		}
		for _, interval := range []string{"month", "year"} {
			quote, currency, err := billing.QuoteForOwner(ctx, client, ownerUserId, code, countryCode, interval)
			if err == ErrPlanNotFound {
				break
			}
			if err != nil {
				return nil, err
			}
			view := PlanView{Id: code + "_" + interval + "ly", PlanCode: code, Tier: definition.Tier, Interval: interval, Price: money(quote.AmountMinor, currency), ListPrice: money(quote.ListAmountMinor, currency), Discount: quote.DiscountKind}
			if definition.TrialAllowed {
				view.TrialDays = trialRules.TrialDays
			}
			views = append(views, view)
		}
	}
	return views, nil
}

func (billing Billing) BuildOffer(ctx context.Context, userId, profileId string) (map[string]any, error) {
	profile, found, err := billing.Container.Identity.FindProfile(ctx, profileId)
	if err != nil {
		return nil, err
	}
	if !found || profile.OwnerUserId != userId {
		return nil, ErrProfileNotFound
	}
	trialRules, pricing := billing.rules(ctx)
	client := billing.Container.Client(billing.Container.Resources.Database)
	reasons, err := billing.TrialIneligibility(ctx, client, CheckoutRequest{UserId: userId, ProfileId: profileId, PlanCode: constants.PlanSellerPro}, true)
	if err != nil {
		return nil, err
	}
	hasBlue, err := billing.ownerHasLiveBlue(ctx, client, userId)
	if err != nil {
		return nil, err
	}
	goldMonthly, _, _ := billing.QuoteForOwner(ctx, client, userId, constants.PlanGoldOnly, firstNonEmpty(profile.CountryCode, billing.Container.Settings.DefaultCountry), "month")
	goldYearly, currency, _ := billing.QuoteForOwner(ctx, client, userId, constants.PlanGoldOnly, firstNonEmpty(profile.CountryCode, billing.Container.Settings.DefaultCountry), "year")
	trial, err := client.Subscription.Query().Where(subscription.ProfileID(profileId), subscription.StatusEQ(subscription.StatusTrialing)).First(ctx)
	var activeTrial any
	if err == nil {
		activeTrial = map[string]any{
			"planId": trial.PlanCode + "_" + trial.Interval.String() + "ly", "tier": constants.Plans[trial.PlanCode].Tier, "interval": trial.Interval.String(), "startedAt": trial.CreatedAt,
			"endsAt": trial.TrialEndsAt, "daysLeft": daysUntil(trial.TrialEndsAt, billing.Container.Now()), "isCancelled": trial.CancelAtPeriodEnd, "cardSummary": trial.CardLabel,
			"priceAfterTrial": money(trial.AmountMinor, trial.Currency), "verificationCharge": map[string]any{"amount": money(5000, trial.Currency), "status": "REFUNDED"},
		}
	} else if !ent.IsNotFound(err) {
		return nil, err
	}
	return map[string]any{
		"profileName": profile.DisplayName, "trialLength": map[bool]string{true: "MONTH_1", false: "DAYS_7"}[trialRules.TrialDays >= 30], "trialDays": trialRules.TrialDays,
		"yearlyDiscountPercent": pricing.Pricing.YearlyDiscountBps / 100, "verificationCharge": money(5000, "NGN"), "isEligible": len(reasons) == 0, "ineligibleReasons": reasons,
		"activeTrial": activeTrial, "bundle": map[string]any{"hasActiveBlue": hasBlue, "discountPercent": pricing.Pricing.BundleDiscountBps / 100, "maximumBusinesses": pricing.Pricing.BundleMaximumBusinesses},
		"goldOnlyPlan": map[string]any{"monthly": money(goldMonthly.AmountMinor, currency), "yearly": money(goldYearly.AmountMinor, currency)},
	}, nil
}

func daysUntil(at *time.Time, now time.Time) int {
	if at == nil {
		return 0
	}
	return max(int(at.Sub(now).Hours()/24+0.999), 0)
}
