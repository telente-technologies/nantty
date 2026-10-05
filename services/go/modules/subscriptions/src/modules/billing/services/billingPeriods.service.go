package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"zudomart/modules/subscriptions/src/models"
)

type PeriodView struct {
	Id                string            `json:"id"`
	InvoiceNumber     string            `json:"invoiceNumber"`
	Kind              string            `json:"kind"`
	Plan              string            `json:"plan"`
	Interval          string            `json:"interval"`
	PeriodStartsAt    time.Time         `json:"periodStartsAt"`
	PeriodEndsAt      time.Time         `json:"periodEndsAt"`
	LineItems         []models.LineItem `json:"lineItems"`
	Total             map[string]any    `json:"total"`
	Status            string            `json:"status"`
	CheckmarkIncluded bool              `json:"checkmarkIncluded"`
	AttemptCount      int               `json:"attemptCount"`
	FailureReason     string            `json:"failureReason,omitempty"`
	PaidAt            *time.Time        `json:"paidAt"`
}

func ConvertPeriod(period *ent.SubscriptionPeriod) PeriodView {
	return PeriodView{
		Id: period.ID.String(), InvoiceNumber: InvoiceNumber(period), Kind: period.Kind.String(), Plan: period.PlanCode, Interval: period.Interval,
		PeriodStartsAt: period.PeriodStartsAt, PeriodEndsAt: period.PeriodEndsAt, LineItems: period.LineItems, Total: money(period.AmountDueMinor, period.Currency),
		Status: period.Status.String(), CheckmarkIncluded: period.CheckmarkIncluded, AttemptCount: period.AttemptCount, FailureReason: period.FailureReason, PaidAt: period.PaidAt,
	}
}

func (billing Billing) ListPeriods(ctx context.Context, userId string, subscriptionId uuid.UUID) ([]PeriodView, error) {
	row, err := billing.ownedEngineRow(ctx, userId, subscriptionId)
	if err != nil {
		return nil, err
	}
	periods, err := billing.Container.Client(billing.Container.Resources.Database).SubscriptionPeriod.Query().Where(subscriptionperiod.SubscriptionID(row.ID.String())).
		Order(ent.Desc(subscriptionperiod.FieldPeriodStartsAt)).Limit(60).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]PeriodView, 0, len(periods))
	for _, period := range periods {
		views = append(views, ConvertPeriod(period))
	}
	return views, nil
}

type UpcomingChargeView struct {
	ChargeAt string         `json:"chargeAt"`
	Plan     NextPeriodPlan `json:"plan"`
	Charges  bool           `json:"willCharge"`
}

func (billing Billing) PreviewUpcomingCharge(ctx context.Context, userId string, subscriptionId uuid.UUID) (UpcomingChargeView, error) {
	row, err := billing.ownedEngineRow(ctx, userId, subscriptionId)
	if err != nil {
		return UpcomingChargeView{}, err
	}
	chargeAt := dueDateOf(row)
	plan, err := billing.PlanNextPeriod(ctx, billing.Container.Client(billing.Container.Resources.Database), row, chargeAt, "", "")
	if err != nil {
		return UpcomingChargeView{}, err
	}
	return UpcomingChargeView{ChargeAt: chargeAt.UTC().Format(time.RFC3339), Plan: plan, Charges: IsEngineManaged(row) && !row.CancelAtPeriodEnd}, nil
}
