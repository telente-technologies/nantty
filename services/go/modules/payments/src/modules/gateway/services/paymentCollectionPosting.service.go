package services

import (
	"context"
	"database/sql"
	"fmt"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/modules/gateway/models"
)

func IsConnectedAccountCharge(intent *ent.PaymentIntent) bool {
	return intent.ConnectedAccountID != "" && intent.BeneficiaryUserID != ""
}

func AppliedCollectionAmount(intent *ent.PaymentIntent) int64 {
	if IsConnectedAccountCharge(intent) {
		return intent.AmountMinor - intent.ProviderFeeMinor
	}
	return intent.AmountMinor
}

func (gateway *PaymentGateway) postCollectionJournalEntries(ctx context.Context, transaction *sql.Tx, intent *ent.PaymentIntent) error {
	if IsConnectedAccountCharge(intent) {
		return gateway.postConnectedAccountCollection(ctx, transaction, intent)
	}
	platformBalance := ledgermodels.PlatformProviderBalanceAccount(intent.Provider, intent.Currency)
	_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "payment-received:" + intent.Reference, Kind: "payment.received", ExternalReference: intent.Reference,
		Description: "Payment received into the platform account",
		Metadata:    map[string]any{"paymentIntentId": intent.ID.String(), "purpose": string(intent.Purpose)},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: platformBalance, Direction: ledgermodels.Debit, AmountMinor: intent.AmountMinor},
			{Account: ledgermodels.PaymentsAwaitingApplicationAccount(intent.Currency), Direction: ledgermodels.Credit, AmountMinor: intent.AmountMinor},
		},
	})
	if err != nil || intent.ProviderFeeMinor == 0 {
		return err
	}
	_, err = gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "payment-fee:" + intent.Reference, Kind: "payment.feeCharged", Description: "Payment processing fee",
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.PaymentProcessingFeeExpenseAccount(intent.Currency), Direction: ledgermodels.Debit, AmountMinor: intent.ProviderFeeMinor},
			{Account: platformBalance, Direction: ledgermodels.Credit, AmountMinor: intent.ProviderFeeMinor},
		},
	})
	return err
}

func (gateway *PaymentGateway) postConnectedAccountCollection(ctx context.Context, transaction *sql.Tx, intent *ent.PaymentIntent) error {
	sellerNet := intent.AmountMinor - intent.PlatformFeeMinor - intent.ProviderFeeMinor
	if sellerNet < 0 {
		return fmt.Errorf("payment %s fees exceed the amount paid", intent.Reference)
	}
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.SellerProviderHeldFundsAccount(intent.BeneficiaryUserID, intent.Currency), Direction: ledgermodels.Debit, AmountMinor: sellerNet},
	}
	if intent.PlatformFeeMinor > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformProviderBalanceAccount(intent.Provider, intent.Currency), Direction: ledgermodels.Debit, AmountMinor: intent.PlatformFeeMinor})
	}
	lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PaymentsAwaitingApplicationAccount(intent.Currency), Direction: ledgermodels.Credit, AmountMinor: AppliedCollectionAmount(intent)})
	_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "payment-received:" + intent.Reference, Kind: "payment.receivedInSellerAccount", ExternalReference: intent.Reference,
		Description: "Payment received into the seller's provider account",
		Metadata: map[string]any{
			"paymentIntentId": intent.ID.String(), "purpose": string(intent.Purpose), "connectedAccountId": intent.ConnectedAccountID,
			"platformFeeMinor": intent.PlatformFeeMinor, "processingFeeMinor": intent.ProviderFeeMinor,
		},
		Lines: lines,
	})
	return err
}

func (gateway *PaymentGateway) refundDuplicatePaymentInTransaction(ctx context.Context, transaction *sql.Tx, intent *ent.PaymentIntent) (RequestedRefund, error) {
	reference := "duplicate-refund-" + intent.Reference
	applied := AppliedCollectionAmount(intent)
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.PaymentsAwaitingApplicationAccount(intent.Currency), Direction: ledgermodels.Debit, AmountMinor: applied}}
	if IsConnectedAccountCharge(intent) {
		lines = AppendPositiveLine(lines, ledgermodels.RefundedProcessingFeesExpenseAccount(intent.Currency), ledgermodels.Debit, intent.ProviderFeeMinor)
		lines = append(lines,
			ledgermodels.JournalLineRequest{Account: ledgermodels.SellerDebtAccount(intent.BeneficiaryUserID, intent.Currency), Direction: ledgermodels.Debit, AmountMinor: applied},
			ledgermodels.JournalLineRequest{Account: ledgermodels.SellerProviderHeldFundsAccount(intent.BeneficiaryUserID, intent.Currency), Direction: ledgermodels.Credit, AmountMinor: applied})
	}
	lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.RefundsPayableAccount(intent.Provider, intent.Currency), Direction: ledgermodels.Credit, AmountMinor: intent.AmountMinor})
	if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "payment.duplicateRefunded", Description: "Duplicate payment returned to the payer",
		Metadata: map[string]any{"paymentIntentId": intent.ID.String()}, Lines: lines,
	}); err != nil {
		return RequestedRefund{}, err
	}
	refund, err := gateway.RequestRefundInTransaction(ctx, transaction, models.RefundRequest{
		PaymentIntentId: intent.ID, AmountMinor: intent.AmountMinor, Currency: intent.Currency, Reference: reference, Reason: "duplicate payment",
	})
	if err != nil {
		return RequestedRefund{}, err
	}
	return refund, gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payment.duplicateRefunded", intent.ID.String(), gateway.Container.Now().UTC(), paymentEventData(intent))
}

func AppendPositiveLine(lines []ledgermodels.JournalLineRequest, account ledgermodels.AccountRef, direction ledgermodels.Direction, amountMinor int64) []ledgermodels.JournalLineRequest {
	if amountMinor <= 0 {
		return lines
	}
	return append(lines, ledgermodels.JournalLineRequest{Account: account, Direction: direction, AmountMinor: amountMinor})
}
