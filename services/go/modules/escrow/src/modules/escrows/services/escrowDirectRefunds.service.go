package services

import (
	"context"
	"database/sql"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
)

func isDirectSale(held *ent.Escrow) bool {
	return held.PaymentMode == escrow.PaymentModeDirect
}

func (service EscrowService) refundDirectSaleInTransaction(ctx context.Context, transaction *sql.Tx, client *ent.Client, held *ent.Escrow, reason string, actor EscrowActor) (EscrowSettlementResult, error) {
	now := service.Container.Now().UTC()
	rest := min(held.AmountMinor-held.RefundedMinor, held.SellerAmountMinor-held.RefundedMinor)
	if rest <= 0 {
		return EscrowSettlementResult{Escrow: held, AlreadySettled: true}, nil
	}
	refunded, err := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).
		SetStatus(escrow.StatusRefunded).SetRefundedAt(now).SetRefundedMinor(held.RefundedMinor + rest).ClearAutoReleaseAt().Save(ctx)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	reference := "escrow-refund:" + held.ID.String()
	metadata := map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "reason": reason, "actorType": actor.Type, "actorId": actor.Id}
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.SellerDebtAccount(held.SellerUserID, held.Currency), Direction: ledgermodels.Debit, AmountMinor: rest},
		{Account: ledgermodels.RefundsPayableAccount(held.Provider, held.Currency), Direction: ledgermodels.Credit, AmountMinor: rest},
	}
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference + ":sellerDebt", Kind: "directPayment.refundedFromPlatform", Description: "Refund of direct order " + held.OrderReference + " recovered from the seller",
		Metadata: metadata, Lines: lines,
	}); err != nil {
		return EscrowSettlementResult{}, err
	}
	refundId, err := service.requestProviderRefund(ctx, transaction, held, rest, reference, reason)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	return service.finishSettlement(ctx, transaction, client, refunded, "refunded", reason, actor, &refundId)
}

func (service EscrowService) recordLostChargebackOnDirectSale(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, notice paymentmodels.ProviderDisputeNotice) error {
	if held.Status == escrow.StatusRefunded || held.Status == escrow.StatusClawedBack {
		return nil
	}
	reference := "chargeback-lost:" + held.ID.String() + ":" + notice.ProviderDisputeId
	if _, posted, err := service.Container.Ledger.FindJournalEntryByReference(ctx, transaction, reference); err != nil || posted {
		return err
	}
	disputed := notice.AmountMinor
	if disputed <= 0 || disputed > held.AmountMinor {
		disputed = held.AmountMinor
	}
	unrecovered := max(min(disputed, held.AmountMinor-held.RefundedMinor), 0)
	if unrecovered == 0 {
		return nil
	}
	withheldFrom, err := service.chargebackWithholdingAccount(ctx, transaction, held, notice.ProviderDisputeId)
	if err != nil {
		return err
	}
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "escrow.chargebackLost", Description: "Chargeback lost on direct order " + held.OrderReference,
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "providerDisputeId": notice.ProviderDisputeId},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.SellerDebtAccount(held.SellerUserID, held.Currency), Direction: ledgermodels.Debit, AmountMinor: unrecovered},
			{Account: withheldFrom, Direction: ledgermodels.Credit, AmountMinor: unrecovered},
		},
	}); err != nil {
		return err
	}
	refundedMinor := held.RefundedMinor + unrecovered
	status := escrow.StatusRefunded
	if refundedMinor < held.AmountMinor {
		status = escrow.StatusPartiallyRefunded
	}
	return held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(status).SetRefundedAt(service.Container.Now().UTC()).SetRefundedMinor(refundedMinor).Exec(ctx)
}

func (service EscrowService) chargebackWithholdingAccount(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, providerDisputeId string) (ledgermodels.AccountRef, error) {
	_, withheld, err := service.Container.Ledger.FindJournalEntryByReference(ctx, transaction, "chargeback-withheld:"+providerDisputeId)
	if withheld {
		return ledgermodels.PlatformChargebackReceivableAccount(held.Provider, held.Currency), err
	}
	return ledgermodels.PlatformProviderBalanceAccount(held.Provider, held.Currency), err
}
