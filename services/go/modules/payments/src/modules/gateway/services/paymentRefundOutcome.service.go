package services

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/paymentrefund"
	"nantty/modules/payments/src/interfaces"
)

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
