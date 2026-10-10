package services

import (
	"net/http"
	"time"

	"zudomart/modules/subscriptions/src/container"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/models"
	"zudomart/modules/subscriptions/src/repositories"
	"zudomart/platform/httpserver"
)

var (
	ErrCreatorPlanNotFound      = httpserver.NewApiError(http.StatusNotFound, "PLAN_NOT_FOUND", "Subscription plan was not found.")
	ErrCreatorSubscriptionGone  = httpserver.NewApiError(http.StatusNotFound, "SUBSCRIPTION_NOT_FOUND", "Subscription was not found.")
	ErrCreatorNotApproved       = httpserver.NewApiError(http.StatusUnprocessableEntity, "CREATOR_NOT_ACCEPTING", "This creator is not accepting subscriptions right now.")
	ErrCreatorProgramRequired   = httpserver.NewApiError(http.StatusForbidden, "CREATOR_PROGRAM_REQUIRED", "Subscription plans are available to approved creators.")
	ErrCannotSubscribeToSelf    = httpserver.NewApiError(http.StatusUnprocessableEntity, "CANNOT_SUBSCRIBE_TO_SELF", "You cannot subscribe to yourself.")
	ErrSubscriptionBlocked      = httpserver.NewApiError(http.StatusUnprocessableEntity, "SUBSCRIPTION_BLOCKED", "You cannot subscribe to this creator.")
	ErrAlreadySubscribedCreator = httpserver.NewApiError(http.StatusConflict, "ALREADY_SUBSCRIBED", "You are already subscribed to this creator.")
	ErrResumeInstead            = httpserver.NewApiError(http.StatusConflict, "RESUME_INSTEAD", "Your subscription is still running; resume it instead of subscribing again.")
	ErrOnlyActiveCancellable    = httpserver.NewApiError(http.StatusConflict, "INVALID_STATE", "Only an active subscription can be cancelled.")
	ErrSubscriptionEnded        = httpserver.NewApiError(http.StatusConflict, "INVALID_STATE", "This subscription has ended; subscribe again.")
	ErrPriceOutsideBands        = httpserver.NewApiError(http.StatusUnprocessableEntity, "PRICE_OUTSIDE_BANDS", "Choose a price inside the regional subscription price range.")
	ErrCurrencyNotPriced        = httpserver.NewApiError(http.StatusUnprocessableEntity, "CURRENCY_NOT_SUPPORTED", "Subscription plans can't be priced in this currency.")
)

type CreatorSubscriptions struct {
	Container *container.Container
}

type MoneyView struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type CreatorPlanView struct {
	Id              string                      `json:"id"`
	CreatorId       string                      `json:"creatorId"`
	Name            string                      `json:"name"`
	Description     string                      `json:"description"`
	Price           MoneyView                   `json:"price"`
	Interval        string                      `json:"interval"`
	Benefits        []string                    `json:"benefits"`
	BenefitDetails  []models.CreatorPlanBenefit `json:"benefitDetails"`
	SubscriberCount int                         `json:"subscriberCount"`
	Active          bool                        `json:"active"`
}

type CreatorSubscriptionStateView struct {
	SubscriptionId   string     `json:"subscriptionId"`
	CreatorId        string     `json:"creatorId"`
	SubscriberId     string     `json:"subscriberId"`
	PlanId           string     `json:"planId"`
	Status           string     `json:"status"`
	Price            MoneyView  `json:"price"`
	Interval         string     `json:"interval"`
	CurrentPeriodEnd *time.Time `json:"currentPeriodEnd"`
	RenewsAt         *time.Time `json:"renewsAt"`
	CreatedAt        time.Time  `json:"createdAt"`
	BillingChannel   string     `json:"billingChannel"`
	StoreProductId   *string    `json:"storeProductId"`
}

type CreatorSubscriberView struct {
	Id       string                    `json:"id"`
	User     *repositories.UserSummary `json:"user"`
	PlanId   string                    `json:"planId"`
	PlanName string                    `json:"planName"`
	Since    time.Time                 `json:"since"`
	RenewsAt *time.Time                `json:"renewsAt"`
	Status   string                    `json:"status"`
}

type CreatorCheckoutView struct {
	SubscriptionId   string                       `json:"subscriptionId"`
	CheckoutUrl      string                       `json:"checkoutUrl"`
	AuthorizationUrl string                       `json:"authorizationUrl"`
	Reference        string                       `json:"reference"`
	Subscription     CreatorSubscriptionStateView `json:"subscription"`
}

func ConvertCreatorPlan(plan *ent.CreatorSubscriptionPlan, subscriberCount int) CreatorPlanView {
	names := make([]string, 0, len(plan.Benefits))
	for _, benefit := range plan.Benefits {
		names = append(names, benefit.Name)
	}
	return CreatorPlanView{
		Id: plan.ID.String(), CreatorId: plan.CreatorID, Name: plan.Name, Description: plan.Description, Price: MoneyView{plan.AmountMinor, plan.Currency},
		Interval: plan.Interval.String(), Benefits: names, BenefitDetails: plan.Benefits, SubscriberCount: subscriberCount, Active: plan.Active,
	}
}

func renewsAtOf(row *ent.CreatorSubscription) *time.Time {
	if row.Status.String() == "active" {
		return row.CurrentPeriodEnd
	}
	return nil
}

func ConvertCreatorSubscription(row *ent.CreatorSubscription) CreatorSubscriptionStateView {
	return CreatorSubscriptionStateView{
		SubscriptionId: row.ID.String(), CreatorId: row.CreatorID, SubscriberId: row.SubscriberID, PlanId: row.PlanID, Status: row.Status.String(),
		Price: MoneyView{row.AmountMinor, row.Currency}, Interval: row.Interval.String(), CurrentPeriodEnd: row.CurrentPeriodEnd, RenewsAt: renewsAtOf(row), CreatedAt: row.CreatedAt,
		BillingChannel: row.BillingChannel.String(), StoreProductId: storeProductIdOf(row),
	}
}

func storeProductIdOf(row *ent.CreatorSubscription) *string {
	if row.StoreProductID == "" {
		return nil
	}
	return &row.StoreProductID
}

func ConvertCreatorSubscriber(row *ent.CreatorSubscription, user *repositories.UserSummary, planName string) CreatorSubscriberView {
	since := row.CreatedAt
	if row.CurrentPeriodStart != nil {
		since = *row.CurrentPeriodStart
	}
	return CreatorSubscriberView{Id: row.ID.String(), User: user, PlanId: row.PlanID, PlanName: planName, Since: since, RenewsAt: renewsAtOf(row), Status: row.Status.String()}
}
