package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	paymentconstants "zudomart/modules/payments/src/constants"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"zudomart/modules/subscriptions/src/models"
)

type firstPeriodRequest struct {
	SubscriptionId uuid.UUID
	PeriodId       uuid.UUID
	OwnerUserId    string
	ProfileId      string
	PlanCode       string
	Interval       string
	Currency       string
	Charge         models.PeriodCharge
	StartsAt       time.Time
	ReturnTo       string
	Kind           subscriptionperiod.Kind
	EndsAt         *time.Time
	PeriodPrice    int64
}

func (billing Billing) settleFreeFirstPeriodInTransaction(ctx context.Context, transaction *sql.Tx, subscriptionId, periodId uuid.UUID) error {
	row, err := billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(subscriptionId)).ForUpdate().Only(ctx)
	if err != nil {
		return err
	}
	return billing.settlePeriodInTransaction(ctx, transaction, row, periodId, "", "", nil)
}

func (billing Billing) createFirstPeriodInTransaction(ctx context.Context, transaction *sql.Tx, request firstPeriodRequest) (uuid.UUID, error) {
	kind := request.Kind
	if kind == "" {
		kind = subscriptionperiod.KindFirst
	}
	endsAt := models.NextPeriodEnd(request.StartsAt, request.StartsAt.Day(), request.Interval)
	if request.EndsAt != nil {
		endsAt = *request.EndsAt
	}
	periodPrice := request.PeriodPrice
	if periodPrice == 0 {
		periodPrice = request.Charge.SubtotalMinor + models.DiscountLinesTotalMinor(request.Charge) + request.Charge.CreditAppliedMinor
	}
	key := models.RenewalIdempotencyKey(request.SubscriptionId.String(), request.StartsAt)
	if kind == subscriptionperiod.KindUpgrade {
		key = "upgrade:" + request.SubscriptionId.String() + ":" + request.StartsAt.UTC().Format("20060102T150405Z")
	}
	err := billing.Container.Client(transaction).SubscriptionPeriod.Create().SetID(request.PeriodId).SetSubscriptionID(request.SubscriptionId.String()).SetKind(kind).
		SetPlanCode(request.PlanCode).SetInterval(request.Interval).SetPeriodStartsAt(request.StartsAt).SetPeriodEndsAt(endsAt).SetLineItems(request.Charge.LineItems).
		SetPeriodPriceMinor(periodPrice).SetSubtotalMinor(request.Charge.SubtotalMinor).SetCreditAppliedMinor(request.Charge.CreditAppliedMinor).
		SetAmountDueMinor(request.Charge.AmountDueMinor).SetCurrency(request.Currency).SetCheckmarkIncluded(request.Charge.CheckmarkIncluded).
		SetIdempotencyKey(key).SetCreatedAt(billing.Container.Now()).Exec(ctx)
	if err != nil || request.Charge.AmountDueMinor == 0 {
		return uuid.Nil, err
	}
	intent, err := billing.Container.Payments.CreatePendingPaymentIntentInTransaction(ctx, transaction, paymentmodels.CreatePaymentIntentRequest{
		Purpose: paymentconstants.PurposeSubscriptionRenewal, OwnerUserId: request.OwnerUserId, SubjectId: request.PeriodId.String(),
		AmountMinor: request.Charge.AmountDueMinor, Currency: request.Currency, ReturnTo: request.ReturnTo,
		Metadata: map[string]string{"subscriptionId": request.SubscriptionId.String(), "periodId": request.PeriodId.String(), "profileId": request.ProfileId, "idempotencyKey": key},
	})
	if err != nil {
		return uuid.Nil, err
	}
	return intent.Id, nil
}
