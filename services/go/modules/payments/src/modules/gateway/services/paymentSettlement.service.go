package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/orderpayable"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

func (gateway *PaymentGateway) VerifyAndSettlePaymentIntentByReference(ctx context.Context, reference string) (models.PaymentIntentView, error) {
	database := gateway.Container.Resources.Database
	intent, err := gateway.Container.Client(database).PaymentIntent.Query().Where(paymentintent.Reference(reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return models.PaymentIntentView{}, ErrPaymentNotFound
	}
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	if intent.Status != paymentintent.StatusPending {
		return ConvertPaymentIntentToView(intent), nil
	}
	provider, err := gateway.Container.Provider(intent.Provider)
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	verification, err := provider.VerifyCharge(ctx, reference)
	if err != nil {
		return models.PaymentIntentView{}, convertProviderError(err)
	}
	if verification.Outcome == interfaces.OutcomePending {
		return ConvertPaymentIntentToView(intent), nil
	}
	var settled *ent.PaymentIntent
	var mismatch bool
	err = databases.RunInMoneyTransaction(ctx, database, func(ctx context.Context, transaction *sql.Tx) error {
		settled, mismatch, err = gateway.applyVerificationInTransaction(ctx, transaction, intent.ID.String(), verification)
		return err
	})
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	if mismatch {
		return ConvertPaymentIntentToView(settled), ErrPaymentAmountMismatch
	}
	return ConvertPaymentIntentToView(settled), nil
}

func (gateway *PaymentGateway) applyVerificationInTransaction(ctx context.Context, transaction *sql.Tx, intentId string, verification interfaces.ChargeVerification) (*ent.PaymentIntent, bool, error) {
	client := gateway.Container.Client(transaction)
	intent, err := client.PaymentIntent.Query().Where(paymentintent.Reference(verification.Reference)).ForUpdate().Only(ctx)
	if err != nil {
		return nil, false, err
	}
	if intent.ID.String() != intentId {
		return nil, false, fmt.Errorf("provider returned reference %q for another payment", verification.Reference)
	}
	if intent.Status != paymentintent.StatusPending {
		return intent, false, nil
	}
	now := gateway.Container.Now().UTC()
	amountMatches := verification.AmountMinor == intent.AmountMinor && verification.Currency == intent.Currency
	if verification.Outcome == interfaces.OutcomeFailed || !amountMatches {
		reason := verification.FailureReason
		if !amountMatches {
			reason = fmt.Sprintf("amountMismatch: provider reported %d %s", verification.AmountMinor, verification.Currency)
		}
		failed, err := intent.Update().Where(paymentintent.Version(intent.Version)).AddVersion(1).
			SetStatus(paymentintent.StatusFailed).SetFailureReason(truncateReason(reason)).SetFailedAt(now).
			SetProviderTransactionID(verification.ProviderTransactionId).Save(ctx)
		if err != nil {
			return nil, false, err
		}
		if err := gateway.notifyPurposeOfFailure(ctx, transaction, failed); err != nil {
			return nil, false, err
		}
		eventType := "payment.failed"
		if !amountMatches {
			eventType = "paymentAmountMismatch.detected"
		}
		return failed, !amountMatches, gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, failed.ID.String(), now, paymentEventData(failed))
	}
	succeeded, err := intent.Update().Where(paymentintent.Version(intent.Version)).AddVersion(1).
		SetStatus(paymentintent.StatusSucceeded).SetPaidAt(now).SetProviderTransactionID(verification.ProviderTransactionId).
		SetProviderFeeMinor(max(verification.ProviderFeeMinor, 0)).Save(ctx)
	if err != nil {
		return nil, false, err
	}
	if err := gateway.postCollectionJournalEntries(ctx, transaction, succeeded); err != nil {
		return nil, false, err
	}
	handler, err := gateway.purposeHandler(string(succeeded.Purpose))
	if err != nil {
		return nil, false, err
	}
	settledPayment, err := gateway.buildSettledPayment(ctx, client, succeeded)
	if err != nil {
		return nil, false, err
	}
	if err := handler.HandleSucceededPayment(ctx, transaction, settledPayment); err != nil {
		return nil, false, err
	}
	return succeeded, false, gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payment.succeeded", succeeded.ID.String(), now, paymentEventData(succeeded))
}

func (gateway *PaymentGateway) postCollectionJournalEntries(ctx context.Context, transaction *sql.Tx, intent *ent.PaymentIntent) error {
	clearing := ledgermodels.ProviderClearingAccount(intent.Provider, intent.Currency)
	_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "payment-received:" + intent.Reference, Kind: "payment.received", ExternalReference: intent.Reference,
		Description: "Payment received from " + intent.Provider,
		Metadata:    map[string]any{"paymentIntentId": intent.ID.String(), "purpose": string(intent.Purpose)},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: clearing, Direction: ledgermodels.Debit, AmountMinor: intent.AmountMinor},
			{Account: ledgermodels.PaymentsAwaitingApplicationAccount(intent.Currency), Direction: ledgermodels.Credit, AmountMinor: intent.AmountMinor},
		},
	})
	if err != nil || intent.ProviderFeeMinor == 0 {
		return err
	}
	_, err = gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "payment-fee:" + intent.Reference, Kind: "payment.feeCharged", Description: intent.Provider + " processing fee",
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.PaymentProcessingFeeExpenseAccount(intent.Currency), Direction: ledgermodels.Debit, AmountMinor: intent.ProviderFeeMinor},
			{Account: clearing, Direction: ledgermodels.Credit, AmountMinor: intent.ProviderFeeMinor},
		},
	})
	return err
}

func (gateway *PaymentGateway) notifyPurposeOfFailure(ctx context.Context, transaction *sql.Tx, intent *ent.PaymentIntent) error {
	handler, err := gateway.purposeHandler(string(intent.Purpose))
	if err != nil {
		return err
	}
	payment, err := gateway.buildSettledPayment(ctx, gateway.Container.Client(transaction), intent)
	if err != nil {
		return err
	}
	return handler.HandleFailedPayment(ctx, transaction, payment)
}

func (gateway *PaymentGateway) buildSettledPayment(ctx context.Context, client *ent.Client, intent *ent.PaymentIntent) (models.SettledPayment, error) {
	payment := models.SettledPayment{
		IntentId: intent.ID, Reference: intent.Reference, Purpose: string(intent.Purpose), OwnerUserId: intent.OwnerUserID,
		SubjectId: intent.SubjectID, Provider: intent.Provider, AmountMinor: intent.AmountMinor, Currency: intent.Currency,
		ProviderFeeMinor: intent.ProviderFeeMinor, ProviderTransactionId: intent.ProviderTransactionID, FailureReason: intent.FailureReason,
		SettledAt: gateway.Container.Now().UTC(),
	}
	if intent.Purpose != constants.PurposeOrderCheckout {
		return payment, nil
	}
	payables, err := client.OrderPayable.Query().Where(orderpayable.CheckoutID(intent.SubjectID)).Order(ent.Asc(orderpayable.FieldCreatedAt)).All(ctx)
	if err != nil {
		return payment, err
	}
	if len(payables) == 0 {
		return payment, errors.New("checkout has no registered order payables")
	}
	for _, payable := range payables {
		payment.OrderPayables = append(payment.OrderPayables, ConvertOrderPayable(payable))
	}
	return payment, nil
}

func ConvertOrderPayable(payable *ent.OrderPayable) models.OrderPayable {
	return models.OrderPayable{
		CheckoutId: payable.CheckoutID, OrderId: payable.OrderID, OrderReference: payable.OrderReference, BuyerUserId: payable.BuyerUserID,
		StoreId: payable.StoreID, SellerUserId: payable.SellerUserID, AmountMinor: payable.AmountMinor, Currency: payable.Currency, ProductSummary: payable.ProductSummary,
	}
}

func paymentEventData(intent *ent.PaymentIntent) map[string]any {
	return map[string]any{
		"paymentId": intent.ID.String(), "reference": intent.Reference, "purpose": string(intent.Purpose), "subjectId": intent.SubjectID,
		"ownerUserId": intent.OwnerUserID, "provider": intent.Provider, "status": string(intent.Status),
		"amount": map[string]any{"amountMinor": intent.AmountMinor, "currency": intent.Currency},
	}
}

func truncateReason(reason string) string {
	if len(reason) > 300 {
		return reason[:300]
	}
	return reason
}
