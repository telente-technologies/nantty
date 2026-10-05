package services

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/subscriptions/src/constants"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/loaders"
	"zudomart/platform/httpserver"
	"zudomart/platform/regionpricing"
)

var ErrNoVerificationSubscription = httpserver.NewApiError(http.StatusConflict, "NO_ACTIVE_SUBSCRIPTION", "You don't have an active verification subscription.")

var verificationPlanCodes = map[string][]string{
	constants.ProfilePersonal: {constants.PlanBlueEssential, constants.PlanBlue, constants.PlanPremium},
	constants.ProfileBusiness: {constants.PlanGoldOnly, constants.PlanSellerPro, constants.PlanSellerBusiness},
	constants.ProfileBrand:    {constants.PlanGoldOnly, constants.PlanSellerPro, constants.PlanSellerBusiness},
}

type VerificationPlanView struct {
	Id       string             `json:"id"`
	PlanCode string             `json:"planCode"`
	Name     string             `json:"name"`
	Color    string             `json:"color"`
	Tier     string             `json:"tier"`
	Price    map[string]any     `json:"price"`
	Interval string             `json:"interval"`
	Perks    []loaders.PlanPerk `json:"perks"`
}

type VerificationSubscriptionView struct {
	SubscriptionId    string     `json:"subscriptionId"`
	PlanId            string     `json:"planId"`
	Status            string     `json:"status"`
	RenewsAt          *time.Time `json:"renewsAt"`
	CurrentPeriodEnd  *time.Time `json:"currentPeriodEnd"`
	CancelAtPeriodEnd bool       `json:"cancelAtPeriodEnd"`
}

type VerificationCurrentView struct {
	Status       string `json:"status"`
	Type         string `json:"type"`
	Color        string `json:"color"`
	Tier         string `json:"tier"`
	BadgeVisible bool   `json:"badgeVisible"`
}

type MyVerificationView struct {
	Current      *VerificationCurrentView      `json:"current"`
	Subscription *VerificationSubscriptionView `json:"subscription"`
	Application  any                           `json:"application"`
}

func verificationColorOf(planCode string) string {
	if checkmark := constants.Plans[planCode].Checkmark; checkmark != "" {
		return checkmark
	}
	return "blue"
}

func (billing Billing) ListVerificationPlans(ctx context.Context, userId string, resolution regionpricing.Resolution) ([]VerificationPlanView, error) {
	profile, found, err := billing.Container.Identity.FindActingProfile(ctx, userId)
	if err != nil {
		return nil, err
	}
	profileType := constants.ProfilePersonal
	if found {
		profileType = profile.ProfileType
	}
	if found && profile.CountryCode != "" {
		resolution.CountryCode = profile.CountryCode
	}
	plans, err := billing.ListPlans(ctx, userId, resolution, verificationPlanCodes[profileType])
	if err != nil {
		return nil, err
	}
	views := make([]VerificationPlanView, 0, len(plans))
	for _, plan := range plans {
		views = append(views, VerificationPlanView{
			Id: plan.Id, PlanCode: plan.PlanCode, Name: plan.DisplayName, Color: verificationColorOf(plan.PlanCode), Tier: plan.Tier, Price: plan.Price, Interval: plan.Interval, Perks: plan.Perks,
		})
	}
	return views, nil
}

func (billing Billing) liveVerificationSubscription(ctx context.Context, profileId string) (*ent.Subscription, error) {
	codes := append(append([]string{}, verificationPlanCodes[constants.ProfilePersonal]...), verificationPlanCodes[constants.ProfileBusiness]...)
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.ProfileID(profileId), subscription.PlanCodeIn(append(codes, constants.PlanBlack)...), subscription.StatusIn(liveStatuses()...)).
		Order(ent.Desc(subscription.FieldCreatedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func (billing Billing) MyVerification(ctx context.Context, userId string) (MyVerificationView, error) {
	profile, found, err := billing.Container.Identity.FindActingProfile(ctx, userId)
	if err != nil || !found {
		return MyVerificationView{}, err
	}
	view := MyVerificationView{}
	row, err := billing.liveVerificationSubscription(ctx, profile.ProfileId)
	if err != nil {
		return view, err
	}
	if row != nil {
		status := map[subscription.Status]string{subscription.StatusPastDue: "past_due", subscription.StatusGrace: "past_due"}[row.Status]
		if status == "" {
			status = "active"
		}
		subscriptionView := &VerificationSubscriptionView{
			SubscriptionId: row.ID.String(), PlanId: row.PlanCode + "_" + row.Interval.String() + "ly", Status: status, CurrentPeriodEnd: row.CurrentPeriodEndsAt, CancelAtPeriodEnd: row.CancelAtPeriodEnd,
		}
		if !row.CancelAtPeriodEnd {
			subscriptionView.RenewsAt = row.CurrentPeriodEndsAt
		}
		view.Subscription = subscriptionView
	}
	checkmark, hasCheckmark, err := billing.Container.Identity.FindProfileCheckmark(ctx, profile.ProfileId)
	if err != nil || !hasCheckmark {
		return view, err
	}
	current := &VerificationCurrentView{Type: profile.ProfileType, Color: checkmark.Color, Tier: map[string]string{"blue": "VERIFIED", "gold": "PRO", "black": "OFFICIAL"}[checkmark.Color]}
	current.Status = map[string]string{"verified": "active", "grace": "active", "suspended": "revoked", "revoked": "revoked", "expired": "expired"}[checkmark.Status]
	current.BadgeVisible = checkmark.Status == "verified" || checkmark.Status == "grace"
	if row != nil && constants.Plans[row.PlanCode].Tier != "" {
		current.Tier = constants.Plans[row.PlanCode].Tier
	}
	view.Current = current
	return view, nil
}

func (billing Billing) CancelVerificationSubscription(ctx context.Context, userId string) (MyVerificationView, error) {
	profile, found, err := billing.Container.Identity.FindActingProfile(ctx, userId)
	if err != nil {
		return MyVerificationView{}, err
	}
	if !found {
		return MyVerificationView{}, ErrNoVerificationSubscription
	}
	row, err := billing.liveVerificationSubscription(ctx, profile.ProfileId)
	if err != nil {
		return MyVerificationView{}, err
	}
	if row == nil || row.OwnerUserID != userId {
		return MyVerificationView{}, ErrNoVerificationSubscription
	}
	if !row.CancelAtPeriodEnd {
		if _, err := billing.CancelSubscription(ctx, userId, row.ID); err != nil {
			return MyVerificationView{}, err
		}
	}
	return billing.MyVerification(ctx, userId)
}

func (billing Billing) FindOwnedSubscriptionView(ctx context.Context, userId, subscriptionId string) (any, error) {
	id, err := uuid.Parse(subscriptionId)
	if err != nil {
		return nil, ErrSubscriptionMissing
	}
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().Where(subscription.ID(id), subscription.OwnerUserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrSubscriptionMissing
	}
	if err != nil {
		return nil, err
	}
	return ConvertSubscription(row), nil
}
