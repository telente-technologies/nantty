package services

import (
	"context"
	"time"

	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptioncoveredprofile"
	"zudomart/modules/subscriptions/src/models"
)

type CombinedGoldTier struct {
	Profiles    int   `json:"profiles"`
	DiscountBps int64 `json:"discountBps"`
}

type CombinedGoldRulesView struct {
	MaximumProfiles int                `json:"maximumProfiles"`
	YearlyExtraBps  int64              `json:"yearlyExtraBps"`
	YearlyMode      string             `json:"yearlyMode"`
	Tiers           []CombinedGoldTier `json:"tiers"`
}

type CombinedGoldBusiness struct {
	ProfileId   string `json:"profileId"`
	DisplayName string `json:"displayName"`
	ProfileType string `json:"profileType"`
	Coverage    string `json:"coverage"`
	HasOwnGold  bool   `json:"hasOwnGold"`
}

type CombinedGoldSubscriptionView struct {
	Id                string                 `json:"id"`
	Status            string                 `json:"status"`
	Interval          string                 `json:"interval"`
	Price             map[string]any         `json:"price"`
	DiscountKind      string                 `json:"discountKind"`
	CurrentPeriodEnd  *time.Time             `json:"currentPeriodEnd"`
	CancelAtPeriodEnd bool                   `json:"cancelAtPeriodEnd"`
	Covered           []CombinedGoldBusiness `json:"coveredProfiles"`
}

type CombinedGoldOverview struct {
	Premium      bool                          `json:"premium"`
	Rules        CombinedGoldRulesView         `json:"rules"`
	Businesses   []CombinedGoldBusiness        `json:"businesses"`
	Subscription *CombinedGoldSubscriptionView `json:"subscription"`
}

func combinedGoldRulesViewOf(rules models.CombinedGoldRules) CombinedGoldRulesView {
	view := CombinedGoldRulesView{MaximumProfiles: rules.MaximumProfiles, YearlyExtraBps: rules.YearlyExtraBps, YearlyMode: rules.YearlyMode, Tiers: []CombinedGoldTier{}}
	for profiles := 1; profiles <= rules.MaximumProfiles; profiles++ {
		view.Tiers = append(view.Tiers, CombinedGoldTier{Profiles: profiles, DiscountBps: models.CombinedGoldTierBps(rules, profiles)})
	}
	return view
}

func (billing Billing) ReadCombinedGoldOverview(ctx context.Context, userId string) (CombinedGoldOverview, error) {
	client := billing.Container.Client(billing.Container.Resources.Database)
	premium, err := billing.ownerHasLivePremium(ctx, client, userId)
	if err != nil {
		return CombinedGoldOverview{}, err
	}
	overview := CombinedGoldOverview{Premium: premium, Rules: combinedGoldRulesViewOf(billing.combinedGoldRules(ctx)), Businesses: []CombinedGoldBusiness{}}
	owned, err := billing.ownedBusinessProfiles(ctx, userId)
	if err != nil {
		return CombinedGoldOverview{}, err
	}
	row, err := billing.liveCombinedGoldOf(ctx, client, userId)
	if err != nil {
		return CombinedGoldOverview{}, err
	}
	coverage := map[string]string{}
	if row != nil {
		covered, err := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.StatusIn(liveCoverageStatuses...)).All(ctx)
		if err != nil {
			return CombinedGoldOverview{}, err
		}
		for _, entry := range covered {
			coverage[entry.ProfileID] = string(entry.Status)
		}
	}
	goldPlans := []string{}
	for code, definition := range constants.Plans {
		if definition.Checkmark == "gold" && code != constants.PlanGoldCombined {
			goldPlans = append(goldPlans, code)
		}
	}
	ownGold := map[string]bool{}
	if len(owned) > 0 {
		rows, err := client.Subscription.Query().Where(subscription.ProfileIDIn(profileIdsOf(owned)...), subscription.PlanCodeIn(goldPlans...), subscription.StatusIn(liveStatuses()...)).All(ctx)
		if err != nil {
			return CombinedGoldOverview{}, err
		}
		for _, entry := range rows {
			ownGold[entry.ProfileID] = true
		}
	}
	for _, profile := range owned {
		business := CombinedGoldBusiness{ProfileId: profile.ProfileId, DisplayName: profile.DisplayName, ProfileType: profile.ProfileType, Coverage: "none", HasOwnGold: ownGold[profile.ProfileId]}
		if status, found := coverage[profile.ProfileId]; found {
			business.Coverage = status
		}
		overview.Businesses = append(overview.Businesses, business)
	}
	if row != nil {
		view := &CombinedGoldSubscriptionView{
			Id: row.ID.String(), Status: string(row.Status), Interval: row.Interval.String(), Price: money(row.AmountMinor, row.Currency), DiscountKind: string(row.DiscountKind),
			CurrentPeriodEnd: row.CurrentPeriodEndsAt, CancelAtPeriodEnd: row.CancelAtPeriodEnd, Covered: []CombinedGoldBusiness{},
		}
		for _, business := range overview.Businesses {
			if business.Coverage != "none" {
				view.Covered = append(view.Covered, business)
			}
		}
		overview.Subscription = view
	}
	return overview, nil
}
