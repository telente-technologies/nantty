package services

import (
	"context"
	"database/sql"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
)

func isDirectSale(held *ent.Escrow) bool {
	return held.PaymentMode == escrow.PaymentModeDirect
}

func (service EscrowService) refundDirectSaleInTransaction(ctx context.Context, transaction *sql.Tx, client *ent.Client, held *ent.Escrow, reason string, actor EscrowActor) (EscrowSettlementResult, error) {
	now := service.Container.Now().UTC()
	refunded, err := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).
		SetStatus(escrow.StatusRefunded).SetRefundedAt(now).SetRefundedMinor(held.AmountMinor).ClearAutoReleaseAt().Save(ctx)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	reference := "escrow-refund:" + held.ID.String()
	metadata := map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "reason": reason, "actorType": actor.Type, "actorId": actor.Id}
	lines := paymentservices.AppendPositiveLine([]ledgermodels.JournalLineRequest{
		{Account: ledgermodels.SellerDebtAccount(held.SellerUserID, held.Currency), Direction: ledgermodels.Debit, AmountMinor: held.SellerAmountMinor},
		{Account: ledgermodels.RefundsPayableAccount(held.Provider, held.Currency), Direction: ledgermodels.Credit, AmountMinor: held.AmountMinor},
	}, ledgermodels.RefundedProcessingFeesExpenseAccount(held.Currency), ledgermodels.Debit, held.AmountMinor-held.SellerAmountMinor)
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference + ":sellerDebt", Kind: "directPayment.refundedFromPlatform", Description: "Refund of direct order " + held.OrderReference + " recovered from the seller",
		Metadata: metadata, Lines: lines,
	}); err != nil {
		return EscrowSettlementResult{}, err
	}
	refundId, err := service.requestProviderRefund(ctx, transaction, held, held.AmountMinor, reference, reason)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	return service.finishSettlement(ctx, transaction, client, refunded, "refunded", reason, actor, &refundId)
}

func (service EscrowService) recordLostChargebackOnDirectSale(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, notice paymentmodels.ProviderDisputeNotice) error {
	disputed := notice.AmountMinor
	if disputed <= 0 || disputed > held.AmountMinor {
		disputed = held.AmountMinor
	}
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "chargeback-lost:" + held.ID.String(), Kind: "escrow.chargebackLost", Description: "Chargeback lost on direct order " + held.OrderReference,
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "providerDisputeId": notice.ProviderDisputeId},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.SellerDebtAccount(held.SellerUserID, held.Currency), Direction: ledgermodels.Debit, AmountMinor: disputed},
			{Account: ledgermodels.PlatformProviderBalanceAccount(held.Provider, held.Currency), Direction: ledgermodels.Credit, AmountMinor: disputed},
		},
	}); err != nil {
		return err
	}
	status := escrow.StatusRefunded
	if disputed < held.AmountMinor {
		status = escrow.StatusPartiallyRefunded
	}
	return held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(status).SetRefundedAt(service.Container.Now().UTC()).SetRefundedMinor(disputed).Exec(ctx)
}
