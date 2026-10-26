package services

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/modules/escrows/models"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

func (service EscrowService) recoverLostChargebackFromWallets(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, notice paymentmodels.ProviderDisputeNotice) error {
	disputed := notice.AmountMinor
	if disputed <= 0 || disputed > held.AmountMinor {
		disputed = held.AmountMinor
	}
	currency := held.Currency
	receivable := ledgermodels.PlatformChargebackReceivableAccount(held.Provider, currency)
	reference := "chargeback-lost:" + held.ID.String()
	metadata := map[string]any{"escrowId": held.ID.String(), "providerDisputeId": notice.ProviderDisputeId}
	now := service.Container.Now().UTC()
	switch {
	case held.Status == escrow.StatusReleased:
		sellerPart := models.CommissionKeptOnRemainder(held.ReleasedToSellerMinor, held.AmountMinor, disputed)
		commissionPart := models.CommissionKeptOnRemainder(held.CommissionMinor, held.AmountMinor, disputed)
		feePart := disputed - sellerPart - commissionPart
		take, err := service.takeFromSellerWallet(ctx, transaction, held.SellerUserID, currency, sellerPart)
		if err != nil {
			return err
		}
		taken := take.fromHold + take.fromAvailable
		lines := paymentservices.AppendPositiveLine(nil, ledgermodels.WalletDepositHoldAccount(held.SellerUserID, currency), ledgermodels.Debit, take.fromHold)
		lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletAvailableAccount(held.SellerUserID, currency), ledgermodels.Debit, take.fromAvailable)
		lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletOutgoingAccount(held.SellerUserID, currency), ledgermodels.Credit, taken)
		lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletDebtAccount(held.SellerUserID, currency), ledgermodels.Debit, take.shortfall)
		lines = paymentservices.AppendPositiveLine(lines, ledgermodels.PlatformEscrowFeeRevenueAccount(currency), ledgermodels.Debit, commissionPart)
		lines = paymentservices.AppendPositiveLine(lines, ledgermodels.RefundedProcessingFeesExpenseAccount(currency), ledgermodels.Debit, feePart)
		lines = paymentservices.AppendPositiveLine(lines, receivable, ledgermodels.Credit, take.shortfall+commissionPart+feePart)
		if err := service.postEscrowLines(ctx, transaction, held, reference, "escrow.chargebackRecoveredFromSeller", "Chargeback lost on order "+held.OrderReference, lines); err != nil {
			return err
		}
		if err := service.enqueueRecovery(ctx, transaction, held, held.SellerUserID, taken, metadata); err != nil {
			return err
		}
		if take.shortfall > 0 {
			service.Container.Payments.RecordPaymentAlertMetric(ctx, "walletDebt", "userId", held.SellerUserID, "debtMinor", take.shortfall, "escrowId", held.ID.String())
		}
		update := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusClawedBack).SetRefundedAt(now).SetRefundedMinor(disputed)
		if disputed < held.AmountMinor {
			update.SetStatus(escrow.StatusPartiallyRefunded).SetReleasedToSellerMinor(held.ReleasedToSellerMinor - sellerPart)
		}
		return update.Exec(ctx)
	case held.Status == escrow.StatusRefunded, held.Status == escrow.StatusPartiallyRefunded, held.Status == escrow.StatusClawedBack:
		return service.recoverLostChargebackAfterRefund(ctx, transaction, held, notice, disputed)
	case held.Status != escrow.StatusHeld && held.Status != escrow.StatusDisputed:
		return nil
	case held.WalletFundedAt != nil:
		locked := ledgermodels.WalletEscrowLockedAccount(held.BuyerUserID, held.ID.String(), currency)
		lines := moveLines(locked, ledgermodels.WalletOutgoingAccount(held.BuyerUserID, currency), disputed)
		lines = append(lines, service.buyerRefundLines(held, locked, held.AmountMinor-disputed)...)
		if err := service.postEscrowLines(ctx, transaction, held, reference, "escrow.chargebackRecoveredFromBuyerWallet", "Chargeback lost on order "+held.OrderReference, lines); err != nil {
			return err
		}
		if err := service.enqueueRecovery(ctx, transaction, held, held.BuyerUserID, disputed, metadata); err != nil {
			return err
		}
	default:
		if fundIn, err := service.Container.Payments.FindMovementBySubject(ctx, transaction, paymentmodels.MovementEscrowFundIn, held.ID.String()); err != nil {
			return err
		} else if fundIn != nil {
			if cancelled, err := service.Container.Payments.CancelPendingMovementInTransaction(ctx, transaction, fundIn.Reference, "chargeback lost before settlement"); err != nil || !cancelled {
				if err == nil {
					err = ErrEscrowFundsNotSettled
				}
				return err
			}
		}
		inbound := ledgermodels.WalletInboundEscrowAccount(held.BuyerUserID, held.ID.String(), currency)
		lines := moveLines(inbound, receivable, disputed)
		lines = append(lines, moveLines(inbound, ledgermodels.RefundsPayableAccount(held.Provider, currency), held.AmountMinor-disputed)...)
		if err := service.postEscrowLines(ctx, transaction, held, reference, "escrow.chargebackLostBeforeSettlement", "Chargeback lost on order "+held.OrderReference, lines); err != nil {
			return err
		}
		if disputed < held.AmountMinor {
			if _, err := service.requestProviderRefund(ctx, transaction, held, held.AmountMinor-disputed, reference+":rest", "chargeback remainder"); err != nil {
				return err
			}
		}
	}
	return held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusRefunded).SetRefundedAt(now).SetRefundedMinor(held.AmountMinor).ClearAutoReleaseAt().Exec(ctx)
}

func (service EscrowService) enqueueRecovery(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, fromUserId string, amountMinor int64, metadata map[string]any) error {
	if amountMinor <= 0 {
		return nil
	}
	_, err := service.Container.Payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
		Kind: paymentmodels.MovementChargebackRecovery, SubjectId: held.ID.String(), UserId: fromUserId, FromUserId: fromUserId, ToPlatform: true,
		AmountMinor: amountMinor, Currency: held.Currency, Metadata: metadata,
	})
	return err
}
