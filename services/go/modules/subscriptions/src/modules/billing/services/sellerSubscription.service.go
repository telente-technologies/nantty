package services

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"nantty/platform/httpserver"
)

var (
	ErrPaymentNotFound     = httpserver.NewApiError(http.StatusNotFound, "PAYMENT_NOT_FOUND", "We could not find that payment.")
	ErrNoTrial             = httpserver.NewApiError(http.StatusConflict, "NO_TRIAL", "There is no free trial to cancel.")
	ErrResumeNeedsCheckout = httpserver.NewApiError(http.StatusConflict, "CHECKOUT_REQUIRED", "This plan was cancelled with the card provider. Choose the plan again to restart it.")
	ErrNothingToResume     = httpserver.NewApiError(http.StatusConflict, "NOT_CANCELLED", "This plan is not set to cancel.")
)

var sellerPlanCodes = []string{constants.PlanSellerPro, constants.PlanSellerBusiness}
var sellerLiveStatuses = []subscription.Status{subscription.StatusTrialing, subscription.StatusActive, subscription.StatusPastDue, subscription.StatusGrace}

type SellerSubscriptionInvoice struct {
	Id          string         `json:"id"`
	Number      string         `json:"number"`
	Amount      map[string]any `json:"amount"`
	Status      string         `json:"status"`
	PeriodStart string         `json:"periodStart"`
	PeriodEnd   string         `json:"periodEnd"`
	PaidAt      *string        `json:"paidAt"`
}

type SellerSubscriptionDetails struct {
	Subscription         map[string]any              `json:"subscription"`
	PlanId               *string                     `json:"planId"`
	CancelAtPeriodEnd    bool                        `json:"cancelAtPeriodEnd"`
	PaymentMethodSummary *string                     `json:"paymentMethodSummary"`
	Provider             *string                     `json:"provider"`
	Invoices             []SellerSubscriptionInvoice `json:"invoices"`
}

func (billing Billing) liveSellerSubscription(ctx context.Context, userId, profileId string) (*ent.Subscription, error) {
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.OwnerUserID(userId), subscription.ProfileID(profileId), subscription.PlanCodeIn(sellerPlanCodes...), subscription.StatusIn(sellerLiveStatuses...)).
		Order(ent.Desc(subscription.FieldCreatedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func (billing Billing) ReadSellerSubscriptionDetails(ctx context.Context, userId, profileId string) (SellerSubscriptionDetails, error) {
	details := SellerSubscriptionDetails{Invoices: []SellerSubscriptionInvoice{}}
	if profileId == "" {
		return details, nil
	}
	row, err := billing.liveSellerSubscription(ctx, userId, profileId)
	if err != nil || row == nil {
		return details, err
	}
	return billing.detailsOf(ctx, row)
}

func (billing Billing) detailsOf(ctx context.Context, row *ent.Subscription) (SellerSubscriptionDetails, error) {
	planId := row.PlanCode + "_" + row.Interval.String() + "ly"
	var periodEnd *string
	if end := row.CurrentPeriodEndsAt; end != nil {
		text := end.UTC().Format(time.RFC3339)
		periodEnd = &text
	} else if trial := row.TrialEndsAt; trial != nil {
		text := trial.UTC().Format(time.RFC3339)
		periodEnd = &text
	}
	status := string(row.Status)
	if status == "canceled" {
		status = "cancelled"
	}
	details := SellerSubscriptionDetails{
		Subscription: map[string]any{"status": status, "plan": constants.Plans[row.PlanCode].Tier, "currentPeriodEnd": periodEnd},
		PlanId:       &planId, CancelAtPeriodEnd: row.CancelAtPeriodEnd, Invoices: []SellerSubscriptionInvoice{},
	}
	if row.CardLabel != "" {
		details.PaymentMethodSummary = &row.CardLabel
	}
	if IsWebCheckoutChannel(row.Channel) {
		provider := "flutterwave"
		details.Provider = &provider
	}
	periods, err := billing.Container.Client(billing.Container.Resources.Database).SubscriptionPeriod.Query().Where(subscriptionperiod.SubscriptionID(row.ID.String())).
		Order(ent.Desc(subscriptionperiod.FieldPeriodStartsAt)).Limit(24).All(ctx)
	if err != nil {
		return details, err
	}
	for index, period := range periods {
		status := "open"
		switch period.Status {
		case subscriptionperiod.StatusPaid, subscriptionperiod.StatusWaived:
			status = "paid"
		case subscriptionperiod.StatusFailed, subscriptionperiod.StatusVoid:
			status = "failed"
		}
		var paidAt *string
		if period.PaidAt != nil {
			text := period.PaidAt.UTC().Format(time.RFC3339)
			paidAt = &text
		}
		details.Invoices = append(details.Invoices, SellerSubscriptionInvoice{Id: period.ID.String(), Number: "INV-" + period.PeriodStartsAt.Format("200601") + "-" + strconv.Itoa(len(periods)-index),
			Amount: money(period.AmountDueMinor, period.Currency), Status: status, PeriodStart: period.PeriodStartsAt.UTC().Format(time.RFC3339), PeriodEnd: period.PeriodEndsAt.UTC().Format(time.RFC3339), PaidAt: paidAt})
	}
	return details, nil
}

func (billing Billing) FindOwnedSubscriptionByReference(ctx context.Context, userId, reference string) (*ent.Subscription, error) {
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.OwnerUserID(userId), subscription.BillingReference(reference)).Order(ent.Desc(subscription.FieldCreatedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrPaymentNotFound
	}
	return row, err
}

func (billing Billing) SellerDetailsForReference(ctx context.Context, userId, reference string) (SellerSubscriptionDetails, error) {
	row, err := billing.FindOwnedSubscriptionByReference(ctx, userId, reference)
	if err != nil {
		return SellerSubscriptionDetails{}, err
	}
	return billing.detailsOf(ctx, row)
}

func (billing Billing) CancelSellerSubscription(ctx context.Context, userId, profileId string, trialOnly bool) error {
	row, err := billing.liveSellerSubscription(ctx, userId, profileId)
	if err != nil {
		return err
	}
	if row == nil || (trialOnly && row.Status != subscription.StatusTrialing) {
		if trialOnly {
			return ErrNoTrial
		}
		return ErrSubscriptionMissing
	}
	_, err = billing.CancelSubscription(ctx, userId, row.ID)
	return err
}

func (billing Billing) ResumeSellerSubscription(ctx context.Context, userId, profileId string) error {
	row, err := billing.liveSellerSubscription(ctx, userId, profileId)
	if err != nil {
		return err
	}
	if row == nil || !row.CancelAtPeriodEnd {
		return ErrNothingToResume
	}
	if IsWebCheckoutChannel(row.Channel) && row.ProviderPlanCode != "" {
		return ErrResumeNeedsCheckout
	}
	return billing.Container.Client(billing.Container.Resources.Database).Subscription.UpdateOneID(row.ID).SetCancelAtPeriodEnd(false).Exec(ctx)
}
