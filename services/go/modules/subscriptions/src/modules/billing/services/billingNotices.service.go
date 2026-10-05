package services

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/generated/ent/subscriptionreminder"
	"zudomart/modules/subscriptions/src/models"
)

func (billing Billing) SendDueReminders(ctx context.Context, limit int) int {
	client := billing.Container.Client(billing.Container.Resources.Database)
	due, err := client.SubscriptionReminder.Query().Where(subscriptionreminder.SentAtIsNil(), subscriptionreminder.DueAtLTE(billing.Container.Now().UTC())).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	sent := 0
	for _, reminder := range due {
		err := databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			tx := billing.Container.Client(transaction)
			claimed, err := tx.SubscriptionReminder.Update().Where(subscriptionreminder.ID(reminder.ID), subscriptionreminder.SentAtIsNil()).SetSentAt(billing.Container.Now().UTC()).Save(ctx)
			if err != nil || claimed == 0 {
				return err
			}
			row, err := tx.Subscription.Get(ctx, mustParseUuid(reminder.SubscriptionID))
			if err != nil {
				return err
			}
			return billing.sendReminderInTransaction(ctx, transaction, tx, row, reminder)
		})
		if err == nil {
			sent++
		}
	}
	return sent
}

func (billing Billing) sendReminderInTransaction(ctx context.Context, transaction *sql.Tx, client *ent.Client, row *ent.Subscription, reminder *ent.SubscriptionReminder) error {
	kind, _, _ := strings.Cut(reminder.Kind, ":")
	switch {
	case kind == "trialEnding" && row.Status == subscription.StatusTrialing && !row.CancelAtPeriodEnd:
		if !IsEngineManaged(row) {
			return billing.sendLegacyTrialEnding(ctx, transaction, row, reminder.DaysBefore)
		}
		return billing.emitUpcomingCharge(ctx, transaction, client, row, "subscriptionTrial.ending", map[string]any{"daysLeft": reminder.DaysBefore, "trialEndsAt": isoTime(row.TrialEndsAt)})
	case kind == "renewalUpcoming" && row.Status == subscription.StatusActive && !row.CancelAtPeriodEnd && IsEngineManaged(row):
		return billing.emitUpcomingCharge(ctx, transaction, client, row, "subscriptionRenewal.upcoming", map[string]any{"daysLeft": reminder.DaysBefore})
	case kind == "graceEnding" && row.Status == subscription.StatusGrace:
		data, err := billing.subscriptionEventData(ctx, row)
		if err != nil {
			return err
		}
		data["graceEndsAt"], data["amount"] = isoTime(row.GraceEndsAt), money(row.AmountMinor, row.Currency)
		return billing.emit(ctx, transaction, "subscriptionGrace.ending", row.ID.String(), data)
	}
	return nil
}

func (billing Billing) emitUpcomingCharge(ctx context.Context, transaction *sql.Tx, client *ent.Client, row *ent.Subscription, eventType string, extra map[string]any) error {
	chargeAt := dueDateOf(row)
	plan, err := billing.PlanNextPeriod(ctx, client, row, chargeAt, "", "")
	if err != nil {
		return err
	}
	data, err := billing.subscriptionEventData(ctx, row)
	if err != nil {
		return err
	}
	for key, value := range extra {
		data[key] = value
	}
	data["chargeAt"], data["amount"], data["lineItems"] = chargeAt.UTC().Format(time.RFC3339), money(plan.Charge.AmountDueMinor, plan.Currency), plan.Charge.LineItems
	data["checkmarkIncluded"], data["billingNote"], data["nextPlan"], data["nextPlanLabel"] = plan.Charge.CheckmarkIncluded, plan.BillingNote, plan.PlanCode, PlanLabel(plan.PlanCode)
	return billing.emit(ctx, transaction, eventType, row.ID.String(), data)
}

func (billing Billing) sendLegacyTrialEnding(ctx context.Context, transaction *sql.Tx, row *ent.Subscription, daysBefore int) error {
	profile, _, err := billing.Container.Identity.FindProfile(ctx, row.ProfileID)
	if err != nil {
		return err
	}
	return billing.emit(ctx, transaction, "planTrial.ending", row.ID.String(), map[string]any{
		"accountId": row.OwnerUserID, "storeName": profile.DisplayName, "plan": row.PlanCode, "price": money(row.AmountMinor, row.Currency), "interval": row.Interval.String(),
		"daysLeft": daysBefore, "trialEndsAt": isoTime(row.TrialEndsAt), "cardLabel": row.CardLabel,
	})
}

func (billing Billing) engineRowsAfter(ctx context.Context, cursor uuid.UUID, limit int) ([]*ent.Subscription, error) {
	query := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.StatusIn(subscription.StatusActive, subscription.StatusTrialing, subscription.StatusPastDue), subscription.BillingAuthorizationIDNEQ(""), subscription.CancelAtPeriodEnd(false))
	if cursor != uuid.Nil {
		query = query.Where(subscription.IDGT(cursor))
	}
	return query.Order(ent.Asc(subscription.FieldID)).Limit(limit).All(ctx)
}

func (billing Billing) SendPriceChangeNotices(ctx context.Context, limit int) int {
	sent, cursor := 0, uuid.Nil
	for {
		rows, err := billing.engineRowsAfter(ctx, cursor, limit)
		if err != nil || len(rows) == 0 {
			return sent
		}
		for _, row := range rows {
			cursor = row.ID
			if row.PeriodPriceMinor > 0 && billing.sendPriceChangeNotice(ctx, row) {
				sent++
			}
		}
	}
}

func (billing Billing) sendPriceChangeNotice(ctx context.Context, row *ent.Subscription) bool {
	client := billing.Container.Client(billing.Container.Resources.Database)
	nextStart := dueDateOf(row)
	plan, err := billing.PlanNextPeriod(ctx, client, row, nextStart, row.PlanCode, row.Interval.String())
	if err != nil || !plan.NoticeNeeded {
		return false
	}
	now := billing.Container.Now().UTC()
	effective := models.PriceChangeEffectiveAt(now, nextStart, anchorDayOf(row), row.Interval.String())
	err = billing.inTransaction(ctx, row.ID, func(ctx context.Context, transaction *sql.Tx, row *ent.Subscription) error {
		if row.PriceNoticeAmountMinor == plan.BookPriceMinor {
			return nil
		}
		if err := row.Update().SetPriceNoticeAmountMinor(plan.BookPriceMinor).SetPriceEffectiveAt(effective).Exec(ctx); err != nil {
			return err
		}
		data, err := billing.subscriptionEventData(ctx, row)
		if err != nil {
			return err
		}
		data["oldPrice"], data["newPrice"], data["effectiveAt"] = money(row.PeriodPriceMinor, row.Currency), money(plan.BookPriceMinor, plan.Currency), effective.Format(time.RFC3339)
		return billing.emit(ctx, transaction, "subscriptionPrice.changeNotice", row.ID.String(), data)
	})
	return err == nil
}

func (billing Billing) SendCardExpiryNotices(ctx context.Context, limit int) int {
	now := billing.Container.Now().UTC()
	rows, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Query().
		Where(subscription.StatusIn(subscription.StatusActive, subscription.StatusTrialing), subscription.BillingAuthorizationIDNEQ(""), subscription.CancelAtPeriodEnd(false),
			subscription.CardExpiryNoticedAtIsNil(), subscription.CardExpiryYearGT(0), subscription.NextChargeAtLTE(now.Add(time.Duration(models.PriceChangeNoticeDays)*24*time.Hour))).
		Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	sent := 0
	for _, row := range rows {
		if row.NextChargeAt == nil || !models.CardExpiryNoticeDue(row.CardExpiryMonth, row.CardExpiryYear, *row.NextChargeAt, now) {
			continue
		}
		err := billing.inTransaction(ctx, row.ID, func(ctx context.Context, transaction *sql.Tx, row *ent.Subscription) error {
			if row.CardExpiryNoticedAt != nil {
				return nil
			}
			if err := row.Update().SetCardExpiryNoticedAt(now).Exec(ctx); err != nil {
				return err
			}
			data, err := billing.subscriptionEventData(ctx, row)
			if err != nil {
				return err
			}
			data["expiryMonth"], data["expiryYear"], data["chargeAt"] = row.CardExpiryMonth, row.CardExpiryYear, dueDateOf(row).UTC().Format(time.RFC3339)
			return billing.emit(ctx, transaction, "subscriptionCard.expiring", row.ID.String(), data)
		})
		if err == nil {
			sent++
		}
	}
	return sent
}
