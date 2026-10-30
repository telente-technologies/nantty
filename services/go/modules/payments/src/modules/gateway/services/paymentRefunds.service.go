package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/generated/ent/paymentrefund"
	"nantty/modules/payments/src/integrations"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
)

type RequestedRefund struct {
	RefundId  uuid.UUID
	Provider  string
	Reference string
	Replayed  bool
}

func sameRefundRequest(existing *ent.PaymentRefund, request models.RefundRequest) bool {
	return existing.PaymentIntentID == request.PaymentIntentId &&
		existing.AmountMinor == request.AmountMinor &&
		existing.Currency == request.Currency &&
		existing.Reason == truncateReason(request.Reason)
}

func (gateway *PaymentGateway) RequestRefundInTransaction(ctx context.Context, transaction *sql.Tx, request models.RefundRequest) (RequestedRefund, error) {
	client := gateway.Container.Client(transaction)
	existing, err := client.PaymentRefund.Query().Where(paymentrefund.Reference(request.Reference)).Only(ctx)
	if err == nil {
		if !sameRefundRequest(existing, request) {
			return RequestedRefund{}, fmt.Errorf("refund reference %s reused with different details", request.Reference)
		}
		return RequestedRefund{RefundId: existing.ID, Provider: existing.Provider, Reference: existing.Reference, Replayed: true}, nil
	}
	if !ent.IsNotFound(err) {
		return RequestedRefund{}, err
	}
	intent, err := client.PaymentIntent.Query().Where(paymentintent.ID(request.PaymentIntentId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return RequestedRefund{}, ErrPaymentNotFound
	}
	if err != nil {
		return RequestedRefund{}, err
	}
	// The initial reference lookup can race another transaction: an uncommitted
	// refund is invisible until that transaction commits, while the payment-row
	// lock below serializes both requests. Recheck after acquiring the lock so
	// the waiter observes and replays the winner instead of failing on the
	// unique refund-reference constraint.
	existing, err = client.PaymentRefund.Query().Where(paymentrefund.Reference(request.Reference)).Only(ctx)
	if err == nil {
		if !sameRefundRequest(existing, request) {
			return RequestedRefund{}, fmt.Errorf("refund reference %s reused with different details", request.Reference)
		}
		return RequestedRefund{RefundId: existing.ID, Provider: existing.Provider, Reference: existing.Reference, Replayed: true}, nil
	}
	if !ent.IsNotFound(err) {
		return RequestedRefund{}, err
	}
	if intent.Status != paymentintent.StatusSucceeded {
		return RequestedRefund{}, ErrPaymentNotRefundable
	}
	if request.AmountMinor <= 0 || request.Currency != intent.Currency || request.AmountMinor > RefundableMinor(intent) {
		return RequestedRefund{}, ErrRefundExceedsPayment
	}
	if err := intent.Update().AddRefundInFlightMinor(request.AmountMinor).AddVersion(1).Exec(ctx); err != nil {
		return RequestedRefund{}, err
	}
	refund, err := client.PaymentRefund.Create().
		SetPaymentIntentID(intent.ID).SetReference(request.Reference).SetProvider(intent.Provider).
		SetConnectedAccountID(intent.ConnectedAccountID).SetBeneficiaryUserID(intent.BeneficiaryUserID).
		SetFullRefund(intent.RefundedMinor == 0 && intent.RefundInFlightMinor == 0 && request.AmountMinor == intent.AmountMinor).
		SetAmountMinor(request.AmountMinor).SetCurrency(intent.Currency).SetReason(truncateReason(request.Reason)).
		SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return RequestedRefund{}, err
	}
	if err := gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "paymentRefund.requested", refund.ID.String(), refund.CreatedAt, refundEventData(refund)); err != nil {
		return RequestedRefund{}, err
	}
	return RequestedRefund{RefundId: refund.ID, Provider: refund.Provider, Reference: refund.Reference}, nil
}

func RefundableMinor(intent *ent.PaymentIntent) int64 {
	return max(intent.AmountMinor-intent.RefundedMinor-intent.RefundInFlightMinor, 0)
}

func (gateway *PaymentGateway) SendPendingRefundToProvider(ctx context.Context, refundId uuid.UUID) error {
	database := gateway.Container.Resources.Database
	var claimed *ent.PaymentRefund
	var intent *ent.PaymentIntent
	err := databases.RunInMoneyTransaction(ctx, database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		updated, err := client.PaymentRefund.Update().Where(paymentrefund.ID(refundId), paymentrefund.StatusEQ(paymentrefund.StatusPending)).
			SetStatus(paymentrefund.StatusProcessing).AddAttemptCount(1).Save(ctx)
		if err != nil || updated == 0 {
			return err
		}
		if claimed, err = client.PaymentRefund.Get(ctx, refundId); err != nil {
			return err
		}
		intent, err = client.PaymentIntent.Get(ctx, claimed.PaymentIntentID)
		return err
	})
	if err != nil || claimed == nil {
		return err
	}
	if IsWalletPaidIntent(intent) {
		return gateway.refundIntoProviderWallet(ctx, claimed.ID)
	}
	provider, err := gateway.Container.Provider(claimed.Provider)
	if err != nil {
		return err
	}
	if claimed.AttemptCount > 1 {
		if handled, err := gateway.settleRefundSentEarlier(ctx, provider, claimed, intent); handled || err != nil {
			return err
		}
	}
	result, err := provider.RefundCharge(ctx, interfaces.RefundRequest{
		ProviderChargeId: intent.ProviderTransactionID, ChargeReference: intent.Reference, RefundReference: claimed.Reference,
		AmountMinor: claimed.AmountMinor, Currency: claimed.Currency, FullRefund: claimed.FullRefund, Reason: claimed.Reason,
	})
	if err == nil && result.NeedsCustomerDetail {
		if recordErr := gateway.Container.Client(database).PaymentRefund.UpdateOneID(claimed.ID).SetProviderRefundID(result.ProviderRefundId).Exec(ctx); recordErr != nil {
			return recordErr
		}
		return gateway.markRefundAwaitingBankDetails(ctx, claimed.ID, "the bank needs the buyer's account to return this payment")
	}
	var requestError *integrations.ProviderRequestError
	if errors.As(err, &requestError) && requestError.IsDefinitiveRejection() {
		return gateway.recordRefundOutcome(ctx, claimed.ID, interfaces.RefundResult{Outcome: interfaces.OutcomeFailed, FailureReason: requestError.Error()})
	}
	if err != nil {
		return gateway.recordRefundOutcome(ctx, claimed.ID, interfaces.RefundResult{Outcome: interfaces.OutcomePending, FailureReason: "provider call failed; confirm with the provider before retrying"})
	}
	return gateway.recordRefundOutcome(ctx, claimed.ID, result)
}

func (gateway *PaymentGateway) settleRefundSentEarlier(ctx context.Context, provider interfaces.PaymentProvider, claimed *ent.PaymentRefund, intent *ent.PaymentIntent) (bool, error) {
	lookup, supported := provider.(interfaces.RefundLookupProvider)
	if !supported {
		return true, gateway.recordRefundOutcome(ctx, claimed.ID, interfaces.RefundResult{Outcome: interfaces.OutcomePending, FailureReason: "outcome unknown and the provider cannot be asked; confirm it by hand"})
	}
	found, exists, err := lookup.FindRefundByReference(ctx, interfaces.RefundLookup{
		ProviderChargeId: intent.ProviderTransactionID, ChargeReference: intent.Reference, RefundReference: claimed.Reference, SubmittedAfter: claimed.CreatedAt,
	})
	if err != nil {
		return true, gateway.returnRefundToPendingQueue(ctx, claimed.ID, "provider call failed; could not confirm an earlier attempt")
	}
	if !exists {
		return false, nil
	}
	if found.NeedsCustomerDetail {
		if err := gateway.Container.Client(gateway.Container.Resources.Database).PaymentRefund.UpdateOneID(claimed.ID).SetProviderRefundID(found.ProviderRefundId).Exec(ctx); err != nil {
			return true, err
		}
		return true, gateway.markRefundAwaitingBankDetails(ctx, claimed.ID, "the bank needs the buyer's account to return this payment")
	}
	return true, gateway.recordRefundOutcome(ctx, claimed.ID, found)
}

func (gateway *PaymentGateway) returnRefundToPendingQueue(ctx context.Context, refundId uuid.UUID, reason string) error {
	return gateway.Container.Client(gateway.Container.Resources.Database).PaymentRefund.Update().
		Where(paymentrefund.ID(refundId), paymentrefund.StatusEQ(paymentrefund.StatusProcessing)).
		SetStatus(paymentrefund.StatusPending).SetFailureReason(truncateReason(reason)).Exec(ctx)
}

func (gateway *PaymentGateway) RetryPendingRefunds(ctx context.Context, limit int) int {
	_ = gateway.Container.Client(gateway.Container.Resources.Database).PaymentRefund.Update().
		Where(paymentrefund.StatusEQ(paymentrefund.StatusProcessing), paymentrefund.FailureReasonHasPrefix("provider call failed"),
			paymentrefund.UpdatedAtLT(gateway.Container.Now().Add(-10*time.Minute))).
		SetStatus(paymentrefund.StatusPending).Exec(ctx)
	pending, err := gateway.Container.Client(gateway.Container.Resources.Database).PaymentRefund.Query().
		Where(paymentrefund.StatusEQ(paymentrefund.StatusPending)).Order(ent.Asc(paymentrefund.FieldCreatedAt)).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	for _, refund := range pending {
		_ = gateway.SendPendingRefundToProvider(ctx, refund.ID)
	}
	return len(pending)
}

func (gateway *PaymentGateway) HandleRefundNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	open := paymentrefund.StatusIn(paymentrefund.StatusProcessing, paymentrefund.StatusPending, paymentrefund.StatusAwaitingBankDetails)
	refund, err := client.PaymentRefund.Query().Where(paymentrefund.ProviderRefundID(notification.ProviderObjectId), open).Only(ctx)
	if ent.IsNotFound(err) && notification.Reference != "" {
		intent, intentErr := client.PaymentIntent.Query().Where(paymentintent.Reference(notification.Reference)).Only(ctx)
		if intentErr != nil {
			return nil
		}
		refund, err = client.PaymentRefund.Query().Where(paymentrefund.PaymentIntentID(intent.ID), open).Order(ent.Desc(paymentrefund.FieldCreatedAt)).First(ctx)
	}
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	switch {
	case notification.EventType == "refund.processed" || notification.Status == "processed":
		return gateway.recordRefundOutcome(ctx, refund.ID, interfaces.RefundResult{ProviderRefundId: notification.ProviderObjectId, Outcome: interfaces.OutcomeSucceeded})
	case notification.EventType == "refund.failed" || notification.Status == "failed":
		return gateway.recordRefundOutcome(ctx, refund.ID, interfaces.RefundResult{ProviderRefundId: notification.ProviderObjectId, Outcome: interfaces.OutcomeFailed, FailureReason: "refund failed at the provider"})
	case notification.Status == "needs-attention":
		if refund.ProviderRefundID == "" {
			if err := refund.Update().SetProviderRefundID(notification.ProviderObjectId).Exec(ctx); err != nil {
				return err
			}
		}
		return gateway.markRefundAwaitingBankDetails(ctx, refund.ID, "the bank needs the buyer's account to return this payment")
	}
	if notification.ProviderObjectId != "" && refund.ProviderRefundID == "" {
		return refund.Update().SetProviderRefundID(notification.ProviderObjectId).Exec(ctx)
	}
	return nil
}

func (gateway *PaymentGateway) MarkRefundSucceededByProviderRefundId(ctx context.Context, providerRefundId string) error {
	refund, err := gateway.Container.Client(gateway.Container.Resources.Database).PaymentRefund.Query().
		Where(paymentrefund.ProviderRefundID(providerRefundId), paymentrefund.StatusEQ(paymentrefund.StatusProcessing)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return gateway.recordRefundOutcome(ctx, refund.ID, interfaces.RefundResult{ProviderRefundId: providerRefundId, Outcome: interfaces.OutcomeSucceeded})
}

func (gateway *PaymentGateway) recordRefundOutcome(ctx context.Context, refundId uuid.UUID, result interfaces.RefundResult) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return gateway.recordRefundOutcomeInTransaction(ctx, transaction, refundId, result)
	})
}

func (gateway *PaymentGateway) recordRefundOutcomeInTransaction(ctx context.Context, transaction *sql.Tx, refundId uuid.UUID, result interfaces.RefundResult) error {
	client := gateway.Container.Client(transaction)
	refund, err := client.PaymentRefund.Query().Where(paymentrefund.ID(refundId)).ForUpdate().Only(ctx)
	if err != nil || (refund.Status != paymentrefund.StatusProcessing && refund.Status != paymentrefund.StatusPending) {
		return err
	}
	update := refund.Update().SetFailureReason(truncateReason(result.FailureReason))
	if result.ProviderRefundId != "" {
		update.SetProviderRefundID(result.ProviderRefundId)
	}
	now := gateway.Container.Now().UTC()
	switch result.Outcome {
	case interfaces.OutcomeSucceeded:
		if err := update.SetStatus(paymentrefund.StatusSucceeded).SetCompletedAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := client.PaymentIntent.UpdateOneID(refund.PaymentIntentID).AddRefundInFlightMinor(-refund.AmountMinor).AddRefundedMinor(refund.AmountMinor).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		if err := gateway.postRefundPaidOut(ctx, transaction, refund); err != nil {
			return err
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "paymentRefund.succeeded", refund.ID.String(), now, refundEventData(refund))
	case interfaces.OutcomeFailed:
		if err := update.SetStatus(paymentrefund.StatusFailed).SetCompletedAt(now).Exec(ctx); err != nil {
			return err
		}
		if err := client.PaymentIntent.UpdateOneID(refund.PaymentIntentID).AddRefundInFlightMinor(-refund.AmountMinor).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "paymentRefund.failed", refund.ID.String(), now, refundEventData(refund))
	}
	return update.Exec(ctx)
}

func (gateway *PaymentGateway) postRefundPaidOut(ctx context.Context, transaction *sql.Tx, refund *ent.PaymentRefund) error {
	debit := ledgermodels.RefundsPayableAccount(refund.Provider, refund.Currency)
	credit := ledgermodels.PlatformProviderBalanceAccount(refund.Provider, refund.Currency)
	_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "refund-paid:" + refund.Reference, Kind: "payment.refundPaid", ExternalReference: refund.Reference,
		Description: "Refund paid back to the buyer",
		Lines: []ledgermodels.JournalLineRequest{
			{Account: debit, Direction: ledgermodels.Debit, AmountMinor: refund.AmountMinor},
			{Account: credit, Direction: ledgermodels.Credit, AmountMinor: refund.AmountMinor},
		},
	})
	return err
}

func refundEventData(refund *ent.PaymentRefund) map[string]any {
	return map[string]any{
		"refundId": refund.ID.String(), "paymentIntentId": refund.PaymentIntentID.String(), "reference": refund.Reference,
		"amount": map[string]any{"amountMinor": refund.AmountMinor, "currency": refund.Currency},
	}
}
