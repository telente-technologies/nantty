package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"nantty/modules/subscriptions/src/models"
)

const graceEndingNoticeBefore = 48 * time.Hour

func (billing Billing) recordFailedAttemptInTransaction(ctx context.Context, transaction *sql.Tx, row *ent.Subscription, periodId uuid.UUID, reason, actionUrl string) error {
	client := billing.Container.Client(transaction)
	period, err := client.SubscriptionPeriod.Query().Where(subscriptionperiod.ID(periodId)).ForUpdate().Only(ctx)
	if err != nil || period.Status == subscriptionperiod.StatusPaid || period.Status == subscriptionperiod.StatusWaived {
		return err
	}
	if err := period.Update().SetStatus(subscriptionperiod.StatusFailed).SetFailureReason(truncate(reason, 300)).Exec(ctx); err != nil {
		return err
	}
	switch period.Kind {
	case subscriptionperiod.KindFirst:
		if row.Status != subscription.StatusPending {
			return nil
		}
		return row.Update().SetStatus(subscription.StatusCanceled).SetEndedReason("first_payment_failed").SetLastError(truncate(reason, 300)).Exec(ctx)
	case subscriptionperiod.KindUpgrade:
		return row.Update().SetLastError(truncate("upgrade payment failed: "+reason, 300)).Exec(ctx)
	}
	if row.Status != subscription.StatusTrialing && row.Status != subscription.StatusActive && row.Status != subscription.StatusPastDue {
		return nil
	}
	trial := period.Kind == subscriptionperiod.KindTrialConversion
	due := period.PeriodStartsAt
	attempts := row.DunningAttempts + 1
	step := models.NextDunningStep(due, attempts, trial)
	update := row.Update().SetDunningAttempts(attempts).SetDunningDueAt(due).SetLastError(truncate(reason, 300)).AddVersion(1)
	data, err := billing.subscriptionEventData(ctx, row)
	if err != nil {
		return err
	}
	data["attempt"], data["reason"], data["amount"], data["periodId"] = attempts, reason, money(period.AmountDueMinor, period.Currency), period.ID.String()
	data["downgradeAt"], data["trialConversion"], data["retriesLeft"], data["actionUrl"] = models.DowngradeAt(due, trial).Format(time.RFC3339), trial, step.RetriesLeft, actionUrl
	switch step.Action {
	case models.DunningRetry:
		if row, err = update.SetStatus(subscription.StatusPastDue).SetNextChargeAt(step.At).Save(ctx); err != nil {
			return err
		}
		data["retryAt"] = step.At.Format(time.RFC3339)
		return billing.emit(ctx, transaction, "subscriptionPayment.failed", row.ID.String(), data)
	case models.DunningGrace:
		if row, err = update.SetStatus(subscription.StatusGrace).SetGraceEndsAt(step.At).SetNextChargeAt(step.At).Save(ctx); err != nil {
			return err
		}
		data["retryAt"], data["graceEndsAt"] = "", step.At.Format(time.RFC3339)
		if err := billing.scheduleReminderInTransaction(ctx, client, row.ID.String(), "graceEnding:"+step.At.Format("20060102"), 2, step.At.Add(-graceEndingNoticeBefore)); err != nil {
			return err
		}
		if err := billing.emit(ctx, transaction, "subscriptionPayment.failed", row.ID.String(), data); err != nil {
			return err
		}
		return billing.emit(ctx, transaction, "entitlement.graceStarted", row.ProfileID, entitlementData(row, string(row.Status)))
	}
	if row, err = update.Save(ctx); err != nil {
		return err
	}
	reasonCode := "payment_failed"
	if trial {
		reasonCode = "trial_payment_failed"
	}
	return billing.downgradeInTransaction(ctx, transaction, row, reasonCode)
}

func (billing Billing) downgradeInTransaction(ctx context.Context, transaction *sql.Tx, row *ent.Subscription, reason string) error {
	if row.Status == subscription.StatusDowngraded {
		return nil
	}
	row, err := row.Update().SetStatus(subscription.StatusDowngraded).SetEndedReason(reason).ClearNextChargeAt().ClearGraceEndsAt().AddVersion(1).Save(ctx)
	if err != nil {
		return err
	}
	revoked, err := billing.revokedEntitlementData(ctx, transaction, row)
	if err != nil {
		return err
	}
	if err := billing.emit(ctx, transaction, "entitlement.revoked", row.ProfileID, revoked); err != nil {
		return err
	}
	data, err := billing.subscriptionEventData(ctx, row)
	if err != nil {
		return err
	}
	data["reason"], data["checkmarkRemoved"], data["downgradedAt"] = reason, revoked["checkmark"] != "", billing.Container.Now().UTC().Format(time.RFC3339)
	return billing.emit(ctx, transaction, "subscription.downgraded", row.ID.String(), data)
}

func (billing Billing) endCancelledInTransaction(ctx context.Context, transaction *sql.Tx, row *ent.Subscription) error {
	if !row.CancelAtPeriodEnd || (row.Status != subscription.StatusTrialing && row.Status != subscription.StatusActive && row.Status != subscription.StatusPastDue) {
		return nil
	}
	reason := "cancelled"
	if row.Status == subscription.StatusTrialing {
		reason = "trial_cancelled"
	}
	row, err := row.Update().SetStatus(subscription.StatusCanceled).SetEndedReason(reason).ClearNextChargeAt().AddVersion(1).Save(ctx)
	if err != nil {
		return err
	}
	revoked, err := billing.revokedEntitlementData(ctx, transaction, row)
	if err != nil {
		return err
	}
	return billing.emit(ctx, transaction, "entitlement.revoked", row.ProfileID, revoked)
}

func (billing Billing) revokedEntitlementData(ctx context.Context, transaction *sql.Tx, row *ent.Subscription) (map[string]any, error) {
	data := entitlementData(row, string(row.Status))
	checkmark := CheckmarkOfPlan(row.PlanCode)
	if checkmark == "" {
		return data, nil
	}
	others, err := billing.Container.Client(transaction).Subscription.Query().
		Where(subscription.ProfileID(row.ProfileID), subscription.IDNEQ(row.ID), subscription.StatusIn(liveStatuses()...)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, other := range others {
		if CheckmarkOfPlan(other.PlanCode) == checkmark {
			data["checkmark"], data["checkmarkRetainedBy"] = "", other.ID.String()
			break
		}
	}
	return data, nil
}
