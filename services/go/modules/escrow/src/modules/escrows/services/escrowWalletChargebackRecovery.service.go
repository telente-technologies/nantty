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

type chargebackRecoverySplit struct {
	claimOnProvider, fromBuyerWallet, fromSale int64
}

func splitChargebackAfterRefund(held *ent.Escrow, disputed, providerRefunded int64) chargebackRecoverySplit {
	walletRefunded := max(held.RefundedMinor-providerRefunded, 0)
	split := chargebackRecoverySplit{claimOnProvider: min(disputed, providerRefunded)}
	split.fromBuyerWallet = min(disputed-split.claimOnProvider, walletRefunded)
	split.fromSale = max(min(disputed-split.claimOnProvider-split.fromBuyerWallet, held.AmountMinor-held.RefundedMinor), 0)
	return split
}

func (service EscrowService) recoverLostChargebackAfterRefund(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, notice paymentmodels.ProviderDisputeNotice, disputed int64) error {
	if _, recoveredBefore, err := service.Container.Ledger.FindJournalEntryByReference(ctx, transaction, "chargeback-lost:"+held.ID.String()); err != nil || recoveredBefore {
		return err
	}
	reference := "chargeback-lost:" + held.ID.String() + ":" + notice.ProviderDisputeId
	if _, posted, err := service.Container.Ledger.FindJournalEntryByReference(ctx, transaction, reference); err != nil || posted {
		return err
	}
	providerRefunded, err := service.Container.Payments.ProviderRefundedMinorForPaymentInTransaction(ctx, transaction, held.PaymentIntentID)
	if err != nil {
		return err
	}
	split := splitChargebackAfterRefund(held, disputed, providerRefunded)
	if split.fromBuyerWallet+split.fromSale == 0 {
		return nil
	}
	receivable := ledgermodels.PlatformChargebackReceivableAccount(held.Provider, held.Currency)
	metadata := map[string]any{"escrowId": held.ID.String(), "providerDisputeId": notice.ProviderDisputeId}
	buyerLines, buyerTaken, err := service.recoveryLinesFromWallet(ctx, transaction, held.BuyerUserID, held.Currency, split.fromBuyerWallet, receivable)
	if err != nil {
		return err
	}
	sellerWanted := min(split.fromSale, held.ReleasedToSellerMinor)
	sellerLines, sellerTaken, err := service.recoveryLinesFromWallet(ctx, transaction, held.SellerUserID, held.Currency, sellerWanted, receivable)
	if err != nil {
		return err
	}
	platformPart := split.fromSale - sellerWanted
	feePart := min(held.ProcessingFeeMinor, platformPart)
	lines := append(buyerLines, sellerLines...)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.PlatformEscrowFeeRevenueAccount(held.Currency), ledgermodels.Debit, platformPart-feePart)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.RefundedProcessingFeesExpenseAccount(held.Currency), ledgermodels.Debit, feePart)
	lines = paymentservices.AppendPositiveLine(lines, receivable, ledgermodels.Credit, platformPart)
	if err := service.postEscrowLines(ctx, transaction, held, reference, "escrow.chargebackRecoveredAfterRefund", "Chargeback lost on refunded order "+held.OrderReference, lines); err != nil {
		return err
	}
	if err := service.enqueueRecovery(ctx, transaction, held, held.BuyerUserID, buyerTaken, metadata); err != nil {
		return err
	}
	if err := service.enqueueRecovery(ctx, transaction, held, held.SellerUserID, sellerTaken, metadata); err != nil {
		return err
	}
	if split.fromSale == 0 {
		return nil
	}
	return held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusRefunded).
		SetRefundedAt(service.Container.Now().UTC()).SetRefundedMinor(held.RefundedMinor + split.fromSale).Exec(ctx)
}

func (service EscrowService) recoveryLinesFromWallet(ctx context.Context, transaction *sql.Tx, userId, currency string, wanted int64, receivable ledgermodels.AccountRef) ([]ledgermodels.JournalLineRequest, int64, error) {
	if wanted <= 0 {
		return nil, 0, nil
	}
	take, err := service.takeFromSellerWallet(ctx, transaction, userId, currency, wanted)
	if err != nil {
		return nil, 0, err
	}
	taken := take.fromHold + take.fromAvailable
	lines := paymentservices.AppendPositiveLine(nil, ledgermodels.WalletDepositHoldAccount(userId, currency), ledgermodels.Debit, take.fromHold)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletAvailableAccount(userId, currency), ledgermodels.Debit, take.fromAvailable)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletOutgoingAccount(userId, currency), ledgermodels.Credit, taken)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletDebtAccount(userId, currency), ledgermodels.Debit, take.shortfall)
	lines = paymentservices.AppendPositiveLine(lines, receivable, ledgermodels.Credit, take.shortfall)
	if take.shortfall > 0 {
		service.Container.Payments.RecordPaymentAlertMetric(ctx, "walletDebt", "userId", userId, "debtMinor", take.shortfall)
	}
	return lines, taken, nil
}
