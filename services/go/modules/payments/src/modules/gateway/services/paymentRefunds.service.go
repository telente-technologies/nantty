package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/paymentrefund"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

type RequestedRefund struct {
	RefundId  uuid.UUID
	Provider  string
	Reference string
	Replayed  bool
}

func (gateway *PaymentGateway) RequestRefundInTransaction(ctx context.Context, transaction *sql.Tx, request models.RefundRequest) (RequestedRefund, error) {
	client := gateway.Container.Client(transaction)
	existing, err := client.PaymentRefund.Query().Where(paymentrefund.Reference(request.Reference)).Only(ctx)
	if err == nil {
		if existing.PaymentIntentID != request.PaymentIntentId || existing.AmountMinor != request.AmountMinor {
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
	if intent.Status != paymentintent.StatusSucceeded {
		return RequestedRefund{}, ErrPaymentNotRefundable
	}
	if request.AmountMinor <= 0 || request.Currency != intent.Currency || intent.RefundedMinor+request.AmountMinor > intent.AmountMinor {
		return RequestedRefund{}, ErrRefundExceedsPayment
	}
	if err := intent.Update().AddRefundedMinor(request.AmountMinor).AddVersion(1).Exec(ctx); err != nil {
		return RequestedRefund{}, err
	}
	if request.FeeTopUpMinor < 0 || (request.FeeTopUpMinor > 0 && !IsConnectedAccountCharge(intent)) {
		return RequestedRefund{}, fmt.Errorf("a fee top-up only applies to a connected account charge")
	}
	refund, err := client.PaymentRefund.Create().
		SetPaymentIntentID(intent.ID).SetReference(request.Reference).SetProvider(intent.Provider).
		SetConnectedAccountID(intent.ConnectedAccountID).SetBeneficiaryUserID(intent.BeneficiaryUserID).
		SetFullRefund(intent.RefundedMinor == 0 && request.AmountMinor == intent.AmountMinor).SetFeeTopUpMinor(request.FeeTopUpMinor).
		SetAmountMinor(request.AmountMinor).SetCurrency(intent.Currency).SetReason(truncateReason(request.Reason)).
		SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return RequestedRefund{}, err
	}
	return RequestedRefund{RefundId: refund.ID, Provider: refund.Provider, Reference: refund.Reference}, nil
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
	provider, err := gateway.Container.Provider(claimed.Provider)
	if err != nil {
		return err
	}
	if claimed.FeeTopUpMinor > 0 && claimed.FeeTopUpTransferID == "" {
		transfer, err := provider.CreateTransfer(ctx, interfaces.TransferRequest{
			ToConnectedAccountId: claimed.ConnectedAccountID, AmountMinor: claimed.FeeTopUpMinor, Currency: claimed.Currency,
			TransferGroup: intent.Reference, Description: "Fee returned before refund " + claimed.Reference, IdempotencyKey: "fee-topup:" + claimed.ID.String(),
			Metadata: map[string]string{"refundReference": claimed.Reference},
		})
		if err != nil {
			return gateway.returnRefundToPendingQueue(ctx, claimed.ID, "fee top-up transfer failed: "+err.Error())
		}
		if err := gateway.Container.Client(database).PaymentRefund.UpdateOneID(claimed.ID).SetFeeTopUpTransferID(transfer.ProviderTransferId).Exec(ctx); err != nil {
			return err
		}
	}
	result, err := provider.RefundCharge(ctx, interfaces.RefundRequest{
		ProviderChargeId: intent.ProviderTransactionID, ConnectedAccountId: claimed.ConnectedAccountID, RefundReference: claimed.Reference,
		IdempotencyKey: "refund:" + claimed.ID.String(), AmountMinor: claimed.AmountMinor, Currency: claimed.Currency, FullRefund: claimed.FullRefund, Reason: claimed.Reason,
	})
	var requestError *integrations.ProviderRequestError
	if errors.As(err, &requestError) && requestError.IsDefinitiveRejection() {
		return gateway.recordRefundOutcome(ctx, claimed.ID, interfaces.RefundResult{Outcome: interfaces.OutcomeFailed, FailureReason: requestError.Error()})
	}
	if err != nil {
		return gateway.recordRefundOutcome(ctx, claimed.ID, interfaces.RefundResult{Outcome: interfaces.OutcomePending, FailureReason: "provider call failed; confirm with the provider before retrying"})
	}
	return gateway.recordRefundOutcome(ctx, claimed.ID, result)
}

func (gateway *PaymentGateway) returnRefundToPendingQueue(ctx context.Context, refundId uuid.UUID, reason string) error {
	return gateway.Container.Client(gateway.Container.Resources.Database).PaymentRefund.Update().
		Where(paymentrefund.ID(refundId), paymentrefund.StatusEQ(paymentrefund.StatusProcessing)).
		SetStatus(paymentrefund.StatusPending).SetFailureReason(truncateReason(reason)).Exec(ctx)
}

func (gateway *PaymentGateway) RetryPendingRefunds(ctx context.Context, limit int) int {
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

func (gateway *PaymentGateway) HandleRefundNotification(ctx context.Context, providerRefundId, reference, eventType string) error {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	query := client.PaymentRefund.Query().Where(paymentrefund.StatusIn(paymentrefund.StatusProcessing, paymentrefund.StatusPending))
	if reference != "" {
		query = query.Where(paymentrefund.Reference(reference))
	} else {
		query = query.Where(paymentrefund.ProviderRefundID(providerRefundId))
	}
	refund, err := query.Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	switch eventType {
	case "refund.paid":
		return gateway.recordRefundOutcome(ctx, refund.ID, interfaces.RefundResult{ProviderRefundId: providerRefundId, Outcome: interfaces.OutcomeSucceeded})
	case "refund.failed":
		return gateway.recordRefundOutcome(ctx, refund.ID, interfaces.RefundResult{ProviderRefundId: providerRefundId, Outcome: interfaces.OutcomeFailed, FailureReason: "refund failed at the provider"})
	}
	if providerRefundId != "" && refund.ProviderRefundID == "" {
		return refund.Update().SetProviderRefundID(providerRefundId).Exec(ctx)
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
			if err := gateway.postRefundPaidOut(ctx, transaction, refund); err != nil {
				return err
			}
			return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "paymentRefund.succeeded", refund.ID.String(), now, refundEventData(refund))
		case interfaces.OutcomeFailed:
			if err := update.SetStatus(paymentrefund.StatusFailed).SetCompletedAt(now).Exec(ctx); err != nil {
				return err
			}
			return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "paymentRefund.failed", refund.ID.String(), now, refundEventData(refund))
		}
		return update.Exec(ctx)
	})
}

func (gateway *PaymentGateway) postRefundPaidOut(ctx context.Context, transaction *sql.Tx, refund *ent.PaymentRefund) error {
	debit := ledgermodels.RefundsPayableAccount(refund.Provider, refund.Currency)
	credit := ledgermodels.PlatformProviderBalanceAccount(refund.Provider, refund.Currency)
	if refund.ConnectedAccountID != "" && refund.BeneficiaryUserID != "" {
		debit = ledgermodels.SellerRefundsInFlightAccount(refund.BeneficiaryUserID, refund.Currency)
		credit = ledgermodels.SellerProviderHeldFundsAccount(refund.BeneficiaryUserID, refund.Currency)
	}
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
