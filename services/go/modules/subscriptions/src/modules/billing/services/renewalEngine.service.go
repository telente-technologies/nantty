package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"nantty/modules/subscriptions/src/models"
)

const renewalLease = 15 * time.Minute

func IsEngineManaged(row *ent.Subscription) bool {
	return IsWebCheckoutChannel(row.Channel) && row.BillingAuthorizationID != "" && row.ProviderPlanCode == ""
}

func (billing Billing) SweepDueSubscriptions(ctx context.Context, limit int) int {
	now := billing.Container.Now().UTC()
	client := billing.Container.Client(billing.Container.Resources.Database)
	due, err := client.Subscription.Query().Where(subscription.NextChargeAtLTE(now), subscription.StatusIn(liveStatuses()...), subscription.ChannelEQ(subscription.ChannelWebCheckout)).
		Limit(limit).IDs(ctx)
	if err != nil {
		return 0
	}
	queued := 0
	for _, id := range due {
		claimed, err := client.Subscription.Update().Where(subscription.ID(id), subscription.NextChargeAtLTE(now)).SetNextChargeAt(now.Add(renewalLease)).Save(ctx)
		if err != nil || claimed == 0 {
			continue
		}
		if err := billing.EnqueueSubscriptionBillingJob(ctx, id.String()); err != nil {
			_ = client.Subscription.UpdateOneID(id).SetNextChargeAt(now).Exec(ctx)
			continue
		}
		queued++
	}
	return queued
}

func (billing Billing) ProcessDueSubscription(ctx context.Context, subscriptionId string) error {
	id, err := uuid.Parse(subscriptionId)
	if err != nil {
		return nil
	}
	client := billing.Container.Client(billing.Container.Resources.Database)
	row, err := client.Subscription.Get(ctx, id)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil || !IsEngineManaged(row) {
		return err
	}
	now := billing.Container.Now().UTC()
	switch {
	case row.Status == subscription.StatusGrace && row.GraceEndsAt != nil && !now.Before(*row.GraceEndsAt):
		return billing.inTransaction(ctx, id, func(ctx context.Context, transaction *sql.Tx, row *ent.Subscription) error {
			return billing.downgradeInTransaction(ctx, transaction, row, "grace_ended")
		})
	case row.Status == subscription.StatusGrace && row.GraceEndsAt != nil:
		return client.Subscription.UpdateOneID(id).SetNextChargeAt(*row.GraceEndsAt).Exec(ctx)
	case row.CancelAtPeriodEnd && !now.Before(dueDateOf(row)):
		return billing.inTransaction(ctx, id, func(ctx context.Context, transaction *sql.Tx, row *ent.Subscription) error {
			return billing.endCancelledInTransaction(ctx, transaction, row)
		})
	}
	return billing.chargeDuePeriod(ctx, row)
}

func dueDateOf(row *ent.Subscription) time.Time {
	switch {
	case row.DunningDueAt != nil:
		return *row.DunningDueAt
	case row.Status == subscription.StatusTrialing && row.TrialEndsAt != nil:
		return *row.TrialEndsAt
	case row.CurrentPeriodEndsAt != nil:
		return *row.CurrentPeriodEndsAt
	}
	return row.CreatedAt
}

func anchorDayOf(row *ent.Subscription) int {
	if row.BillingAnchorAt != nil {
		return row.BillingAnchorAt.Day()
	}
	return dueDateOf(row).Day()
}

func (billing Billing) ensureDuePeriod(ctx context.Context, row *ent.Subscription) (*ent.SubscriptionPeriod, error) {
	client := billing.Container.Client(billing.Container.Resources.Database)
	starts := dueDateOf(row)
	key := models.RenewalIdempotencyKey(row.ID.String(), starts)
	existing, err := client.SubscriptionPeriod.Query().Where(subscriptionperiod.IdempotencyKey(key)).Only(ctx)
	if err == nil || !ent.IsNotFound(err) {
		return existing, err
	}
	plan, err := billing.PlanNextPeriod(ctx, client, row, starts, "", "")
	if err != nil {
		return nil, err
	}
	kind := subscriptionperiod.KindRenewal
	if row.Status == subscription.StatusTrialing || (row.WithTrial && row.CurrentPeriodEndsAt == nil) {
		kind = subscriptionperiod.KindTrialConversion
	}
	err = client.SubscriptionPeriod.Create().SetID(uuid.Must(uuid.NewV7())).SetSubscriptionID(row.ID.String()).SetKind(kind).SetPlanCode(plan.PlanCode).SetInterval(plan.Interval).
		SetPeriodStartsAt(starts).SetPeriodEndsAt(models.NextPeriodEnd(starts, anchorDayOf(row), plan.Interval)).SetLineItems(plan.Charge.LineItems).SetPeriodPriceMinor(plan.PeriodPriceMinor).
		SetSubtotalMinor(plan.Charge.SubtotalMinor).SetCreditAppliedMinor(plan.Charge.CreditAppliedMinor).SetAmountDueMinor(plan.Charge.AmountDueMinor).
		SetCurrency(plan.Currency).SetCheckmarkIncluded(plan.Charge.CheckmarkIncluded).SetIdempotencyKey(key).SetCreatedAt(billing.Container.Now()).
		OnConflictColumns(subscriptionperiod.FieldIdempotencyKey).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if plan.NoticeNeeded {
		billing.Container.Resources.Logger.InfoContext(ctx, "renewal kept the old price; the price change notice goes out first", "subscriptionId", row.ID.String())
	}
	return client.SubscriptionPeriod.Query().Where(subscriptionperiod.IdempotencyKey(key)).Only(ctx)
}

func (billing Billing) chargeDuePeriod(ctx context.Context, row *ent.Subscription) error {
	period, err := billing.ensureDuePeriod(ctx, row)
	if err != nil {
		return err
	}
	if period.Status == subscriptionperiod.StatusPaid || period.Status == subscriptionperiod.StatusWaived {
		return nil
	}
	if period.AmountDueMinor == 0 {
		return billing.inTransaction(ctx, row.ID, func(ctx context.Context, transaction *sql.Tx, row *ent.Subscription) error {
			return billing.settlePeriodInTransaction(ctx, transaction, row, period.ID, "", "", nil)
		})
	}
	client := billing.Container.Client(billing.Container.Resources.Database)
	attempt, reference := period.AttemptCount, period.PaymentReference
	if reference != "" {
		previous, err := billing.Container.Payments.ConfirmPreviousBillingCharge(ctx, reference)
		if err != nil {
			return err
		}
		switch previous {
		case paymentservices.BillingChargeSucceeded:
			return nil
		case paymentservices.BillingChargePending, paymentservices.BillingChargeRequiresAction:
			return client.Subscription.UpdateOneID(row.ID).SetNextChargeAt(billing.Container.Now().UTC().Add(15 * time.Minute)).Exec(ctx)
		case paymentservices.BillingChargeFailed:
			reference = ""
		}
	}
	if reference == "" {
		attempt++
		reference = models.RenewalChargeReference(period.IdempotencyKey, attempt)
		if err := client.SubscriptionPeriod.UpdateOneID(period.ID).SetAttemptCount(attempt).SetPaymentReference(reference).Exec(ctx); err != nil {
			return err
		}
	}
	result, err := billing.Container.Payments.ChargeBillingAuthorization(ctx, paymentservices.BillingAuthorizationCharge{
		OwnerUserId: row.OwnerUserID, AuthorizationId: row.BillingAuthorizationID, SubjectId: period.ID.String(), Reference: reference,
		AmountMinor: period.AmountDueMinor, Currency: period.Currency, Metadata: map[string]string{"subscriptionId": row.ID.String(), "periodId": period.ID.String(), "idempotencyKey": period.IdempotencyKey},
	})
	if errors.Is(err, paymentservices.ErrBillingAuthorizationMissing) || errors.Is(err, paymentservices.ErrVerifyEmailRequired) {
		result, err = paymentservices.BillingAuthorizationChargeResult{Status: paymentservices.BillingChargeFailed, FailureReason: "We couldn't use the saved card."}, nil
	}
	if err != nil {
		return err
	}
	switch result.Status {
	case paymentservices.BillingChargeRequiresAction, paymentservices.BillingChargeFailed:
		if result.Settled {
			return nil
		}
		return billing.inTransaction(ctx, row.ID, func(ctx context.Context, transaction *sql.Tx, row *ent.Subscription) error {
			return billing.recordFailedAttemptInTransaction(ctx, transaction, row, period.ID, firstNonEmpty(result.FailureReason, "The payment was declined."), result.ActionUrl)
		})
	case paymentservices.BillingChargePending:
		return client.Subscription.UpdateOneID(row.ID).SetNextChargeAt(billing.Container.Now().UTC().Add(time.Hour)).Exec(ctx)
	}
	return nil
}

func (billing Billing) inTransaction(ctx context.Context, id uuid.UUID, work func(context.Context, *sql.Tx, *ent.Subscription) error) error {
	return databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		row, err := billing.Container.Client(transaction).Subscription.Query().Where(subscription.ID(id)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		return work(ctx, transaction, row)
	})
}
