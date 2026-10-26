package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionperiod"
	"nantty/modules/subscriptions/src/generated/ent/subscriptionreminder"
	"nantty/modules/subscriptions/src/models"
)

type RenewalPayments struct {
	Billing  Billing
	Fallback paymentmodels.PaymentPurposeHandler
}

func (handler RenewalPayments) lockedRows(ctx context.Context, transaction *sql.Tx, periodId string) (*ent.Subscription, uuid.UUID, error) {
	id, err := uuid.Parse(periodId)
	if err != nil {
		return nil, uuid.Nil, nil
	}
	client := handler.Billing.Container.Client(transaction)
	period, err := client.SubscriptionPeriod.Get(ctx, id)
	if ent.IsNotFound(err) {
		return nil, id, nil
	}
	if err != nil {
		return nil, id, err
	}
	row, err := client.Subscription.Query().Where(subscription.ID(mustParseUuid(period.SubscriptionID))).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, id, nil
	}
	return row, id, err
}

func (handler RenewalPayments) HandleSucceededPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	row, periodId, err := handler.lockedRows(ctx, transaction, payment.SubjectId)
	if err == nil && row == nil && handler.Fallback != nil {
		return handler.Fallback.HandleSucceededPayment(ctx, transaction, payment)
	}
	if err != nil || row == nil {
		return err
	}
	return handler.Billing.settlePeriodInTransaction(ctx, transaction, row, periodId, payment.Reference, payment.BillingAuthorizationId, payment.Authorization)
}

func (handler RenewalPayments) HandleFailedPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	row, periodId, err := handler.lockedRows(ctx, transaction, payment.SubjectId)
	if err == nil && row == nil && handler.Fallback != nil {
		return handler.Fallback.HandleFailedPayment(ctx, transaction, payment)
	}
	if err != nil || row == nil {
		return err
	}
	return handler.Billing.recordFailedAttemptInTransaction(ctx, transaction, row, periodId, firstNonEmpty(payment.FailureReason, "The payment was declined."), "")
}

func discountKindOf(period *ent.SubscriptionPeriod) subscription.DiscountKind {
	if models.HasOfferDiscountLine(period.LineItems) {
		return subscription.DiscountKindOffer
	}
	for _, item := range period.LineItems {
		switch item.Kind {
		case models.LineItemBundleDiscount:
			return subscription.DiscountKindBundle
		case models.LineItemMultiBusinessDiscount:
			return subscription.DiscountKindMultiBusiness
		}
	}
	if period.Interval == "year" {
		return subscription.DiscountKindYearly
	}
	return subscription.DiscountKindNone
}

func (billing Billing) settlePeriodInTransaction(ctx context.Context, transaction *sql.Tx, row *ent.Subscription, periodId uuid.UUID, paymentReference, authorizationId string, card *paymentmodels.CardAuthorizationHandoff) error {
	client := billing.Container.Client(transaction)
	period, err := client.SubscriptionPeriod.Query().Where(subscriptionperiod.ID(periodId)).ForUpdate().Only(ctx)
	if err != nil || period.Status == subscriptionperiod.StatusPaid || period.Status == subscriptionperiod.StatusWaived {
		return err
	}
	now := billing.Container.Now().UTC()
	status := subscriptionperiod.StatusPaid
	if period.AmountDueMinor == 0 {
		status = subscriptionperiod.StatusWaived
	}
	periodUpdate := period.Update().SetStatus(status).SetPaidAt(now).SetFailureReason("")
	if paymentReference != "" {
		periodUpdate.SetPaymentReference(paymentReference)
	}
	if err := periodUpdate.Exec(ctx); err != nil {
		return err
	}
	if paymentReference != "" && period.AmountDueMinor > 0 {
		if err := billing.postPlanRevenueInTransaction(ctx, transaction, period, paymentReference); err != nil {
			return err
		}
	}
	update := row.Update().SetPlanCode(period.PlanCode).SetInterval(subscription.Interval(period.Interval)).SetStatus(subscription.StatusActive).
		SetDunningAttempts(0).ClearDunningDueAt().ClearGraceEndsAt().SetLastError("").SetCheckmarkIncluded(period.CheckmarkIncluded).
		SetCurrency(period.Currency).SetAmountMinor(period.SubtotalMinor).SetListAmountMinor(period.PeriodPriceMinor).SetPeriodPriceMinor(period.PeriodPriceMinor).
		SetDiscountKind(discountKindOf(period)).SetCreditMinor(max(row.CreditMinor-period.CreditAppliedMinor, 0)).AddVersion(1)
	if period.Kind != subscriptionperiod.KindUpgrade || period.PeriodEndsAt.After(dueDateOf(row)) {
		update.SetCurrentPeriodEndsAt(period.PeriodEndsAt).SetNextChargeAt(period.PeriodEndsAt)
	}
	if period.PlanCode == row.PendingPlanCode || period.Kind == subscriptionperiod.KindUpgrade {
		update.SetPendingPlanCode("").SetPendingInterval("")
	}
	if paymentReference != "" {
		update.SetBillingReference(paymentReference)
	}
	if authorizationId != "" {
		update.SetBillingAuthorizationID(authorizationId)
	}
	if card != nil && card.Last4 != "" {
		update.SetCardLabel(truncate(paymentservices.SavedCardLabel(card.Brand, card.Last4), 60)).SetCardExpiryMonth(card.ExpiryMonth).SetCardExpiryYear(card.ExpiryYear)
		if card.ExpiryMonth != row.CardExpiryMonth || card.ExpiryYear != row.CardExpiryYear {
			update.ClearCardExpiryNoticedAt()
		}
	}
	if period.Kind == subscriptionperiod.KindUpgrade {
		update.SetAmountMinor(period.PeriodPriceMinor)
	}
	if row.BillingAnchorAt == nil {
		update.SetBillingAnchorAt(period.PeriodStartsAt)
	}
	if err := billing.consumeOfferCycleInTransaction(ctx, client, update, row, period); err != nil {
		return err
	}
	if row, err = update.Save(ctx); err != nil {
		return err
	}
	if row.Interval == subscription.IntervalYear && row.CurrentPeriodEndsAt != nil {
		if err := billing.scheduleReminderInTransaction(ctx, client, row.ID.String(), "renewalUpcoming:"+row.CurrentPeriodEndsAt.Format("20060102"), 7, models.YearlyRenewalReminderAt(*row.CurrentPeriodEndsAt)); err != nil {
			return err
		}
	}
	if row.PlanCode == constants.PlanGoldCombined {
		if err := billing.settleCombinedGoldCoverageInTransaction(ctx, transaction, row, period, paymentReference); err != nil {
			return err
		}
	}
	if err := billing.emit(ctx, transaction, "entitlement.granted", row.ProfileID, entitlementData(row, string(row.Status))); err != nil {
		return err
	}
	if period.AmountDueMinor == 0 {
		return nil
	}
	data, err := billing.subscriptionEventData(ctx, row)
	if err != nil {
		return err
	}
	data["invoiceNumber"], data["kind"], data["paidAt"] = InvoiceNumber(period), period.Kind.String(), now.Format(time.RFC3339)
	data["periodStart"], data["periodEnd"], data["lineItems"] = period.PeriodStartsAt.UTC().Format(time.RFC3339), period.PeriodEndsAt.UTC().Format(time.RFC3339), period.LineItems
	data["total"], data["checkmarkIncluded"], data["nextChargeAt"] = money(period.AmountDueMinor, period.Currency), period.CheckmarkIncluded, isoTime(row.NextChargeAt)
	return billing.emit(ctx, transaction, "subscriptionInvoice.paid", row.ID.String(), data)
}

func InvoiceNumber(period *ent.SubscriptionPeriod) string {
	return "INV-" + period.PeriodStartsAt.UTC().Format("20060102") + "-" + period.ID.String()[len(period.ID.String())-8:]
}

func (billing Billing) postPlanRevenueInTransaction(ctx context.Context, transaction *sql.Tx, period *ent.SubscriptionPeriod, paymentReference string) error {
	if billing.Container.Payments == nil || billing.Container.Payments.Container == nil {
		return nil
	}
	_, err := billing.Container.Payments.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "subscription-revenue:" + period.ID.String(), Kind: "subscription.periodBilled", ExternalReference: paymentReference,
		Description: "Plan subscription period billed",
		Metadata:    map[string]any{"subscriptionId": period.SubscriptionID, "periodId": period.ID.String(), "idempotencyKey": period.IdempotencyKey, "lineItems": period.LineItems},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.PaymentsAwaitingApplicationAccount(period.Currency), Direction: ledgermodels.Debit, AmountMinor: period.AmountDueMinor},
			{Account: ledgermodels.PlatformSubscriptionRevenueAccount(period.Currency), Direction: ledgermodels.Credit, AmountMinor: period.AmountDueMinor},
		},
	})
	return err
}

func (billing Billing) scheduleReminderInTransaction(ctx context.Context, client *ent.Client, subscriptionId, kind string, daysBefore int, dueAt time.Time) error {
	if dueAt.Before(billing.Container.Now().UTC().Add(-time.Hour)) {
		return nil
	}
	err := client.SubscriptionReminder.Create().SetSubscriptionID(subscriptionId).SetKind(kind).SetDaysBefore(daysBefore).SetDueAt(dueAt).SetCreatedAt(billing.Container.Now()).
		OnConflictColumns(subscriptionreminder.FieldSubscriptionID, subscriptionreminder.FieldKind, subscriptionreminder.FieldDaysBefore).DoNothing().Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	return err
}

func (billing Billing) subscriptionEventData(ctx context.Context, row *ent.Subscription) (map[string]any, error) {
	profile, _, err := billing.Container.Identity.FindProfile(ctx, row.ProfileID)
	if err != nil {
		return nil, err
	}
	audience := "personal"
	if row.ProfileType != "personal" {
		audience = "business"
	}
	return map[string]any{
		"accountId": row.OwnerUserID, "profileId": row.ProfileID, "subscriptionId": row.ID.String(), "plan": row.PlanCode, "planLabel": PlanLabel(row.PlanCode),
		"accountName": profile.DisplayName, "storeName": profile.DisplayName, "audience": audience, "interval": row.Interval.String(),
		"price": money(row.AmountMinor, row.Currency), "cardLabel": row.CardLabel, "channel": row.Channel.String(),
	}, nil
}
