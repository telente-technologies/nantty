package services

import (
	"context"
	"strings"
	"time"

	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/models"
)

type NextPeriodPlan struct {
	PlanCode         string              `json:"plan"`
	Interval         string              `json:"interval"`
	Currency         string              `json:"currency"`
	PeriodPriceMinor int64               `json:"periodPriceMinor"`
	BookPriceMinor   int64               `json:"bookPriceMinor"`
	Grandfathered    bool                `json:"grandfathered"`
	NoticeNeeded     bool                `json:"-"`
	BillingNote      string              `json:"billingNote,omitempty"`
	Charge           models.PeriodCharge `json:"charge"`
}

var planLabels = map[string]string{
	constants.PlanSellerPro: "Pro plan", constants.PlanSellerBusiness: "Business plan", constants.PlanGoldOnly: "Gold checkmark", constants.PlanBlack: "Black checkmark",
	constants.PlanBlueEssential: "Blue Essential", constants.PlanBlue: "Blue checkmark", constants.PlanPremium: "Zudomart Premium",
}

func PlanLabel(planCode string) string {
	if label, found := planLabels[planCode]; found {
		return label
	}
	return planCode
}

func CheckmarkSplitOf(planCode string) string {
	switch {
	case KeepsPlanOnRejection(planCode):
		return models.CheckmarkSplitFromPlan
	case CheckmarkOfPlan(planCode) != "":
		return models.CheckmarkIsWholePlan
	}
	return models.CheckmarkNotInPlan
}

func checkmarkLabel(planCode string) string {
	color := CheckmarkOfPlan(planCode)
	if color == "" {
		return ""
	}
	return strings.ToUpper(color[:1]) + color[1:] + " checkmark"
}

func bookPeriodPrice(monthlyMinor, yearlyMinor int64, interval string, yearlyDiscountBps int64) int64 {
	if interval != "year" {
		return monthlyMinor
	}
	if yearlyMinor > 0 {
		return yearlyMinor
	}
	list := monthlyMinor * 12
	return list - (list*yearlyDiscountBps+5_000)/10_000
}

func (billing Billing) PlanNextPeriod(ctx context.Context, client *ent.Client, row *ent.Subscription, periodStartsAt time.Time, planOverride, intervalOverride string) (NextPeriodPlan, error) {
	planCode, interval := row.PlanCode, row.Interval.String()
	if row.PendingPlanCode != "" {
		planCode = row.PendingPlanCode
	}
	if row.PendingInterval != "" {
		interval = row.PendingInterval
	}
	if planOverride != "" {
		planCode, interval = planOverride, firstNonEmpty(intervalOverride, interval)
	}
	if planCode == constants.PlanGoldCombined {
		return billing.planCombinedGoldNextPeriod(ctx, client, row, interval)
	}
	profile, _, err := billing.Container.Identity.FindProfile(ctx, row.ProfileID)
	if err != nil {
		return NextPeriodPlan{}, err
	}
	country := firstNonEmpty(profile.CountryCode, billing.Container.Settings.DefaultCountry)
	price, err := billing.RegionalPriceFor(ctx, client, planCode, country, "web")
	if err != nil {
		return NextPeriodPlan{}, err
	}
	if price.NotChargeableOnWeb {
		return NextPeriodPlan{}, ErrWebCurrencyDisabled
	}
	_, pricing := billing.rules(ctx)
	book := bookPeriodPrice(price.AmountFor("web", "month"), price.AmountFor("web", "year"), interval, pricing.Pricing.YearlyDiscountBps)
	plan := NextPeriodPlan{PlanCode: planCode, Interval: interval, Currency: price.Currency, BookPriceMinor: book, PeriodPriceMinor: book, BillingNote: webBillingNote(price)}
	if planCode == row.PlanCode && interval == row.Interval.String() {
		decision := models.DecideRenewalPrice(models.RenewalPriceInput{
			LockedPeriodPriceMinor: row.PeriodPriceMinor, LockedCurrency: row.Currency, BookPeriodPriceMinor: book, BookCurrency: price.Currency,
			NoticedPriceMinor: row.PriceNoticeAmountMinor, NoticeEffectiveAt: row.PriceEffectiveAt, PeriodStartsAt: periodStartsAt,
		})
		plan.PeriodPriceMinor, plan.Grandfathered, plan.NoticeNeeded = decision.PeriodPriceMinor, decision.Grandfathered, decision.NoticeNeeded
	}
	bundleBps := int64(0)
	if constants.Plans[planCode].BundleEligible && interval == "month" {
		if hasBlue, err := billing.ownerHasLiveBlue(ctx, client, row.OwnerUserID); err == nil && hasBlue && billing.bundleSeatAvailable(ctx, client, row) {
			bundleBps = pricing.Pricing.BundleDiscountBps
		}
	}
	credit := row.CreditMinor
	if row.Currency != price.Currency {
		credit = 0
	}
	input := models.PeriodChargeInput{
		PlanLabel: PlanLabel(planCode), CheckmarkLabel: checkmarkLabel(planCode), PeriodPriceMinor: plan.PeriodPriceMinor,
		CheckmarkStandaloneMinor: billing.standaloneCheckmarkPriceMinor(ctx, CheckmarkOfPlan(planCode), price.Currency, "web", interval),
		CheckmarkSplit:           CheckmarkSplitOf(planCode),
		BundleDiscountBps:        bundleBps, AvailableCreditMinor: credit,
	}
	plan.Charge = models.ComputePeriodCharge(input)
	return billing.applyRemainingOfferCycle(row, plan, input, price.AmountFor("web", "month")), nil
}

func (billing Billing) bundleSeatAvailable(ctx context.Context, client *ent.Client, row *ent.Subscription) bool {
	if row.DiscountKind == subscription.DiscountKindBundle {
		return true
	}
	_, pricing := billing.rules(ctx)
	bundled, err := client.Subscription.Query().Where(subscription.OwnerUserID(row.OwnerUserID), subscription.DiscountKindEQ(subscription.DiscountKindBundle), subscription.StatusIn(liveStatuses()...)).Count(ctx)
	return err == nil && bundled < pricing.Pricing.BundleMaximumBusinesses
}

func FirstPeriodCharge(planCode string, quote models.PriceQuote, checkmarkStandaloneMinor int64) models.PeriodCharge {
	periodPrice, bundleBps, offerMinor := quote.ListAmountMinor, int64(0), int64(0)
	switch quote.DiscountKind {
	case models.DiscountKindOffer:
		offerMinor = quote.OfferDiscountMinor
	case "yearly":
		periodPrice = quote.AmountMinor
	case "bundle":
		bundleBps = quote.DiscountBps
	}
	return models.ComputePeriodCharge(models.PeriodChargeInput{
		PlanLabel: PlanLabel(planCode), CheckmarkLabel: checkmarkLabel(planCode), PeriodPriceMinor: periodPrice, CheckmarkStandaloneMinor: checkmarkStandaloneMinor,
		CheckmarkSplit: CheckmarkSplitOf(planCode), BundleDiscountBps: bundleBps, OfferDiscountMinor: offerMinor,
	})
}
