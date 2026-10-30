package services

import (
	"context"

	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptioncoveredprofile"
	"nantty/modules/subscriptions/src/loaders"
	"nantty/modules/subscriptions/src/repositories"
)

type ProfileEntitlement struct {
	ProfileId  string `json:"profileId"`
	Plan       string `json:"plan"`
	Status     string `json:"status"`
	ValidUntil string `json:"validUntil"`
}

type TrialState struct {
	ProfileId   string `json:"profileId"`
	Plan        string `json:"plan"`
	TrialEndsAt string `json:"trialEndsAt"`
	IsCancelled bool   `json:"isCancelled"`
}

type Entitlements struct {
	UserId                string                         `json:"userId"`
	SellerPlan            string                         `json:"sellerPlan"`
	SellerPlanStatus      string                         `json:"sellerPlanStatus"`
	Premium               bool                           `json:"premium"`
	Blue                  bool                           `json:"blue"`
	BlueEssential         bool                           `json:"blueEssential"`
	Gold                  []ProfileEntitlement           `json:"gold"`
	Black                 []ProfileEntitlement           `json:"black"`
	Trial                 *TrialState                    `json:"trial"`
	SubscribedToCreator   bool                           `json:"subscribedToCreator"`
	DashboardEntitlements []loaders.DashboardEntitlement `json:"dashboardEntitlements"`
	AdLoadPercent         int                            `json:"adLoadPercent"`
	CanSchedulePosts      bool                           `json:"canSchedulePosts"`
}

var schedulingSubscriptionStatuses = []subscription.Status{
	subscription.StatusActive,
	subscription.StatusPastDue,
	subscription.StatusGrace,
}

// CanSchedulePostsForProfile resolves scheduling access for one profile.
// Trial-only subscriptions do not satisfy the paid scheduling requirement.
func (billing Billing) CanSchedulePostsForProfile(ctx context.Context, userId, profileId string) (bool, error) {
	if profileId == "" {
		finder, supported := billing.Container.Identity.(repositories.PersonalProfileFinder)
		if !supported {
			return false, nil
		}
		profile, found, err := finder.FindPersonalProfile(ctx, userId)
		if err != nil || !found {
			return false, err
		}
		profileId = profile.ProfileId
	}
	client := billing.Container.Client(billing.Container.Resources.Database)
	rows, err := client.Subscription.Query().
		Where(subscription.OwnerUserID(userId), subscription.StatusIn(schedulingSubscriptionStatuses...)).All(ctx)
	if err != nil {
		return false, err
	}
	for _, row := range rows {
		definition := constants.Plans[row.PlanCode]
		if row.ProfileID == profileId && (definition.Checkmark == "blue" || definition.Checkmark == "gold") {
			return true, nil
		}
		if row.PlanCode != constants.PlanGoldCombined {
			continue
		}
		covered, err := client.SubscriptionCoveredProfile.Query().
			Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.ProfileID(profileId), subscriptioncoveredprofile.StatusIn(grantedCoverageStatuses...)).Exist(ctx)
		if err != nil {
			return false, err
		}
		if covered {
			return true, nil
		}
	}
	return false, nil
}

func (billing Billing) ReadEntitlements(ctx context.Context, userId string) (Entitlements, error) {
	rows, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.OwnerUserID(userId), subscription.StatusIn(liveStatuses()...)).Order(ent.Asc(subscription.FieldCreatedAt)).All(ctx)
	if err != nil {
		return Entitlements{}, err
	}
	result := Entitlements{UserId: userId, SellerPlan: "free", Gold: []ProfileEntitlement{}, Black: []ProfileEntitlement{}}
	rank := map[string]int{"free": 0, "pro": 1, "business": 2}
	livePlanCodes := make([]string, 0, len(rows))
	for _, row := range rows {
		livePlanCodes = append(livePlanCodes, row.PlanCode)
		definition := constants.Plans[row.PlanCode]
		entitlement := ProfileEntitlement{ProfileId: row.ProfileID, Plan: row.PlanCode, Status: string(row.Status), ValidUntil: isoTime(row.CurrentPeriodEndsAt)}
		switch row.PlanCode {
		case constants.PlanPremium:
			result.Premium, result.Blue = true, true
		case constants.PlanBlue:
			result.Blue = true
		case constants.PlanBlueEssential:
			result.BlueEssential = true
		case constants.PlanBlack:
			result.Black = append(result.Black, entitlement)
		}
		switch {
		case row.PlanCode == constants.PlanGoldCombined:
			covered, err := billing.Container.Client(billing.Container.Resources.Database).SubscriptionCoveredProfile.Query().
				Where(subscriptioncoveredprofile.SubscriptionID(row.ID.String()), subscriptioncoveredprofile.StatusIn(grantedCoverageStatuses...)).All(ctx)
			if err != nil {
				return Entitlements{}, err
			}
			for _, profile := range covered {
				entitlement.ProfileId = profile.ProfileID
				result.Gold = append(result.Gold, entitlement)
			}
		case definition.Checkmark == "gold":
			result.Gold = append(result.Gold, entitlement)
		}
		if definition.SellerPlan != "" && rank[definition.SellerPlan] > rank[result.SellerPlan] {
			result.SellerPlan, result.SellerPlanStatus = definition.SellerPlan, string(row.Status)
		}
		if row.Status == subscription.StatusTrialing && result.Trial == nil {
			result.Trial = &TrialState{ProfileId: row.ProfileID, Plan: row.PlanCode, TrialEndsAt: isoTime(row.TrialEndsAt), IsCancelled: row.CancelAtPeriodEnd}
		}
	}
	result.AdLoadPercent = loaders.ReadAdLoadTable(ctx, billing.Container.Resources.Platform).PercentFor(livePlanCodes)
	result.DashboardEntitlements = []loaders.DashboardEntitlement{}
	catalogue := loaders.ReadPlanCatalogue(ctx, billing.Container.Resources.Platform)
	for code, definition := range constants.Plans {
		if definition.SellerPlan != "" && definition.SellerPlan == result.SellerPlan && catalogue[code].DashboardEntitlements != nil {
			result.DashboardEntitlements = catalogue[code].DashboardEntitlements
		}
	}
	return result, nil
}

func (billing Billing) SellerPlanOf(ctx context.Context, userId string) string {
	entitlements, err := billing.ReadEntitlements(ctx, userId)
	if err != nil {
		return "free"
	}
	return entitlements.SellerPlan
}
