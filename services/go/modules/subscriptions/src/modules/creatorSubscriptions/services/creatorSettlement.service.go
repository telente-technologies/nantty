package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/creatorsubscription"
	"zudomart/modules/subscriptions/src/generated/ent/creatorsubscriptioncharge"
	"zudomart/modules/subscriptions/src/models"
)

func (service CreatorSubscriptions) lockCharge(ctx context.Context, transaction *sql.Tx, chargeId string) (*ent.CreatorSubscriptionCharge, *ent.CreatorSubscription, error) {
	id, err := uuid.Parse(chargeId)
	if err != nil {
		return nil, nil, nil
	}
	client := service.Container.Client(transaction)
	charge, err := client.CreatorSubscriptionCharge.Query().Where(creatorsubscriptioncharge.ID(id)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}
	row, err := client.CreatorSubscription.Query().Where(creatorsubscription.ID(uuid.MustParse(charge.SubscriptionID))).ForUpdate().Only(ctx)
	return charge, row, err
}

func (service CreatorSubscriptions) HandleSucceededPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	_, err := service.SettleChargeIfKnown(ctx, transaction, payment)
	return err
}

func (service CreatorSubscriptions) HandleFailedPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	_, err := service.FailChargeIfKnown(ctx, transaction, payment)
	return err
}

func (service CreatorSubscriptions) SettleChargeIfKnown(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) (bool, error) {
	charge, row, err := service.lockCharge(ctx, transaction, payment.SubjectId)
	if err != nil || charge == nil {
		return false, err
	}
	if charge.Status != creatorsubscriptioncharge.StatusPending {
		return true, nil
	}
	now := service.Container.Now().UTC()
	applied := payment.AppliedAmountMinor
	if applied <= 0 {
		applied = payment.AmountMinor
	}
	split := models.SplitCreatorSubscriptionCharge(applied, payment.ProviderFeeMinor)
	if err := service.postChargeRevenue(ctx, transaction, charge, payment.Reference, applied, split); err != nil {
		return true, err
	}
	if err := charge.Update().SetStatus(creatorsubscriptioncharge.StatusSucceeded).SetPaidAt(now).SetProviderFeeMinor(payment.ProviderFeeMinor).
		SetCreatorShareMinor(split.CreatorShareMinor).SetPlatformShareMinor(split.PlatformMinor).SetPaymentReference(payment.Reference).SetFailureReason("").Exec(ctx); err != nil {
		return true, err
	}
	periodStart := now
	if charge.Kind == creatorsubscriptioncharge.KindRenewal && row.CurrentPeriodEnd != nil {
		periodStart = *row.CurrentPeriodEnd
	}
	periodEnd := models.NextCreatorPeriodEnd(periodStart, row.Interval.String())
	update := row.Update().SetCurrentPeriodStart(periodStart).SetCurrentPeriodEnd(periodEnd).SetRenewalAttempts(0).SetLastError("")
	if row.Status != creatorsubscription.StatusCancelled {
		update.SetStatus(creatorsubscription.StatusActive).SetNextChargeAt(periodEnd)
	}
	if charge.Kind == creatorsubscriptioncharge.KindInitial {
		update.SetStatus(creatorsubscription.StatusActive).SetNextChargeAt(periodEnd)
		authorizationId, err := service.Container.Payments.StoreBillingAuthorizationInTransaction(ctx, transaction, row.SubscriberID, payment.Provider, payment.ProviderCustomerId, payment.Authorization)
		if err != nil {
			return true, err
		}
		if authorizationId != "" {
			update.SetBillingAuthorizationID(authorizationId)
		}
	}
	if payment.BillingAuthorizationId != "" {
		update.SetBillingAuthorizationID(payment.BillingAuthorizationId)
	}
	if row, err = update.Save(ctx); err != nil {
		return true, err
	}
	data := chargeEventData(row, charge, split, payment.Reference)
	data["paidAt"], data["periodEnd"] = now.Format(time.RFC3339), periodEnd.UTC().Format(time.RFC3339)
	if err := service.emit(ctx, transaction, "creatorSubscription.paid", row.ID.String(), data); err != nil {
		return true, err
	}
	if charge.Kind == creatorsubscriptioncharge.KindInitial {
		return true, service.emit(ctx, transaction, "creatorSubscription.started", row.ID.String(), data)
	}
	return true, nil
}

func (service CreatorSubscriptions) postChargeRevenue(ctx context.Context, transaction *sql.Tx, charge *ent.CreatorSubscriptionCharge, reference string, applied int64, split models.CreatorChargeSplit) error {
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.PaymentsAwaitingApplicationAccount(charge.Currency), Direction: ledgermodels.Debit, AmountMinor: applied}}
	if split.CreatorShareMinor > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.CreatorEarningsPayableAccount(charge.CreatorID, charge.Currency), Direction: ledgermodels.Credit, AmountMinor: split.CreatorShareMinor})
	}
	if split.PlatformMinor > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.CreatorSubscriptionRevenueAccount(charge.Currency), Direction: ledgermodels.Credit, AmountMinor: split.PlatformMinor})
	}
	_, err := service.Container.Payments.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "creator-subscription-charge:" + charge.ID.String(), Kind: "creatorSubscription.charged", ExternalReference: reference,
		Description: "Creator subscription " + charge.Kind.String() + " payment",
		Metadata: map[string]any{
			"creatorSubscriptionId": charge.SubscriptionID, "chargeId": charge.ID.String(), "creatorId": charge.CreatorID, "netMinor": split.NetMinor, "creatorShareBpsOfNet": models.CreatorShareOfNetBps,
		},
		Lines: lines,
	})
	return err
}

func (service CreatorSubscriptions) FailChargeIfKnown(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) (bool, error) {
	charge, row, err := service.lockCharge(ctx, transaction, payment.SubjectId)
	if err != nil || charge == nil {
		return false, err
	}
	if charge.Status != creatorsubscriptioncharge.StatusPending || (charge.PaymentReference != "" && payment.Reference != charge.PaymentReference) {
		return true, nil
	}
	reason := truncateText(firstText(payment.FailureReason, "The payment was declined."), 300)
	if err := charge.Update().SetStatus(creatorsubscriptioncharge.StatusFailed).SetFailureReason(reason).Exec(ctx); err != nil {
		return true, err
	}
	return true, service.recordFailureInTransaction(ctx, transaction, row, charge, reason)
}

func (service CreatorSubscriptions) recordFailureInTransaction(ctx context.Context, transaction *sql.Tx, row *ent.CreatorSubscription, charge *ent.CreatorSubscriptionCharge, reason string) error {
	now := service.Container.Now().UTC()
	if charge.Kind == creatorsubscriptioncharge.KindInitial {
		if row.Status != creatorsubscription.StatusPending {
			return nil
		}
		return row.Update().SetStatus(creatorsubscription.StatusFailed).SetLastError(reason).ClearNextChargeAt().Exec(ctx)
	}
	if row.Status != creatorsubscription.StatusActive && row.Status != creatorsubscription.StatusPastDue {
		return nil
	}
	if row.CurrentPeriodEnd != nil && !now.Before(row.CurrentPeriodEnd.Add(models.CreatorRenewalGracePeriod)) {
		if err := row.Update().SetStatus(creatorsubscription.StatusExpired).SetLastError(reason).ClearNextChargeAt().Exec(ctx); err != nil {
			return err
		}
		return service.emit(ctx, transaction, "creatorSubscription.expired", row.ID.String(), map[string]any{
			"subscriptionId": row.ID.String(), "creatorId": row.CreatorID, "subscriberId": row.SubscriberID, "reason": "renewal_failed",
		})
	}
	if err := row.Update().SetStatus(creatorsubscription.StatusPastDue).SetLastError(reason).AddRenewalAttempts(1).SetNextChargeAt(now.Add(models.CreatorRenewalRetryInterval)).Exec(ctx); err != nil {
		return err
	}
	return service.emit(ctx, transaction, "creatorSubscription.pastDue", row.ID.String(), map[string]any{
		"subscriptionId": row.ID.String(), "creatorId": row.CreatorID, "subscriberId": row.SubscriberID, "reason": reason, "retryAt": now.Add(models.CreatorRenewalRetryInterval).Format(time.RFC3339),
	})
}

func chargeEventData(row *ent.CreatorSubscription, charge *ent.CreatorSubscriptionCharge, split models.CreatorChargeSplit, reference string) map[string]any {
	return map[string]any{
		"subscriptionId": row.ID.String(), "chargeId": charge.ID.String(), "creatorId": row.CreatorID, "subscriberId": row.SubscriberID, "planId": row.PlanID,
		"kind": charge.Kind.String(), "reference": "creator-subscription-charge:" + charge.ID.String(), "paymentReference": reference, "interval": row.Interval.String(),
		"amount": MoneyView{charge.AmountMinor, charge.Currency}, "creatorShare": MoneyView{split.CreatorShareMinor, charge.Currency}, "net": MoneyView{split.NetMinor, charge.Currency},
	}
}

func firstText(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
