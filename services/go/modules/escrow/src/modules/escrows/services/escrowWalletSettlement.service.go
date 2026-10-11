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

func (service EscrowService) releaseFromBuyerWalletInTransaction(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, trigger string) (*ent.Escrow, error) {
	if held.WalletFundedAt == nil {
		return nil, ErrEscrowFundsNotSettled
	}
	now := service.Container.Now().UTC()
	update := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).
		SetStatus(escrow.StatusReleased).SetReleasedAt(now).SetReleaseTrigger(trigger).SetReleasedToSellerMinor(held.SellerAmountMinor).ClearAutoReleaseAt()
	if trigger == "buyerConfirmed" {
		update.SetBuyerConfirmedAt(now)
	}
	released, err := update.Save(ctx)
	if err != nil {
		return nil, err
	}
	locked := ledgermodels.WalletEscrowLockedAccount(held.BuyerUserID, held.ID.String(), held.Currency)
	if err := service.postEscrowLines(ctx, transaction, held, "escrow-release:"+held.ID.String(), "escrow.releasing", "Order "+held.OrderReference+" released; moving to the seller",
		moveLines(locked, ledgermodels.WalletOutgoingAccount(held.BuyerUserID, held.Currency), held.AmountMinor)); err != nil {
		return nil, err
	}
	return released, service.enqueueSellerShareMovements(ctx, transaction, held, held.SellerAmountMinor, held.CommissionMinor+held.ProcessingFeeMinor, "release")
}

func (service EscrowService) enqueueSellerShareMovements(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, sellerMinor, platformMinor int64, stage string) error {
	metadata := map[string]any{"escrowId": held.ID.String(), "commissionMinor": max(platformMinor-held.ProcessingFeeMinor, 0), "processingFeeMinor": min(held.ProcessingFeeMinor, platformMinor), "stage": stage}
	if sellerMinor > 0 {
		_, err := service.Container.Payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
			Kind: paymentmodels.MovementEscrowRelease, SubjectId: held.ID.String(), UserId: held.SellerUserID, FromUserId: held.BuyerUserID, ToUserId: held.SellerUserID,
			AmountMinor: sellerMinor, Currency: held.Currency, Metadata: metadata,
		})
		return err
	}
	return service.enqueueCommissionMovement(ctx, transaction, held, platformMinor, metadata)
}

func (service EscrowService) enqueueCommissionMovement(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, platformMinor int64, metadata map[string]any) error {
	if platformMinor <= 0 {
		return nil
	}
	_, err := service.Container.Payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
		Kind: paymentmodels.MovementEscrowCommission, SubjectId: held.ID.String(), UserId: held.BuyerUserID, FromUserId: held.BuyerUserID, ToPlatform: true,
		AmountMinor: platformMinor, Currency: held.Currency, Metadata: metadata,
	})
	return err
}

func (service EscrowService) postEscrowLines(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, reference, kind, description string, lines []ledgermodels.JournalLineRequest) error {
	_, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: kind, Description: description, Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID}, Lines: lines,
	})
	return err
}

func (service EscrowService) buyerRefundLines(held *ent.Escrow, from ledgermodels.AccountRef, refundMinor int64) []ledgermodels.JournalLineRequest {
	toHold := min(held.WalletHoldMinor, refundMinor)
	lines := paymentservices.AppendPositiveLine(nil, from, ledgermodels.Debit, refundMinor)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletDepositHoldAccount(held.BuyerUserID, held.Currency), ledgermodels.Credit, toHold)
	return paymentservices.AppendPositiveLine(lines, ledgermodels.WalletAvailableAccount(held.BuyerUserID, held.Currency), ledgermodels.Credit, refundMinor-toHold)
}

func (service EscrowService) refundIntoBuyerWalletInTransaction(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, reason string, actor EscrowActor) (*ent.Escrow, bool, error) {
	if held.WalletFundedAt == nil {
		return service.refundUnfundedEscrowToCard(ctx, transaction, held, reason)
	}
	locked := ledgermodels.WalletEscrowLockedAccount(held.BuyerUserID, held.ID.String(), held.Currency)
	if err := service.postEscrowLines(ctx, transaction, held, "escrow-refund:"+held.ID.String(), "escrow.unlockedForBuyer", "Order "+held.OrderReference+" refunded into your wallet",
		service.buyerRefundLines(held, locked, held.AmountMinor)); err != nil {
		return nil, false, err
	}
	refunded, err := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusRefunded).SetRefundedAt(service.Container.Now().UTC()).
		SetRefundedMinor(held.AmountMinor).ClearAutoReleaseAt().Save(ctx)
	if err == nil && held.WalletHoldMinor > 0 {
		err = service.Container.Payments.RecordWalletCreditHoldInTransaction(ctx, transaction, held.BuyerUserID, "escrow-refund:"+held.ID.String(), "refund", min(held.WalletHoldMinor, held.AmountMinor), held.Currency, service.Container.Payments.Container.Settings.Wallets.DepositHold)
	}
	return refunded, false, err
}

func (service EscrowService) refundUnfundedEscrowToCard(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, reason string) (*ent.Escrow, bool, error) {
	fundIn, err := service.Container.Payments.FindMovementBySubject(ctx, transaction, paymentmodels.MovementEscrowFundIn, held.ID.String())
	if err != nil {
		return nil, false, err
	}
	if fundIn != nil {
		cancelled, err := service.Container.Payments.CancelPendingMovementInTransaction(ctx, transaction, fundIn.Reference, "order refunded before the payment settled: "+reason)
		if err != nil {
			return nil, false, err
		}
		if !cancelled {
			return nil, false, ErrEscrowFundsNotSettled
		}
	}
	inbound := ledgermodels.WalletInboundEscrowAccount(held.BuyerUserID, held.ID.String(), held.Currency)
	if err := service.postEscrowLines(ctx, transaction, held, "escrow-refund:"+held.ID.String(), "escrow.refundedToCard", "Order "+held.OrderReference+" refunded to the card",
		moveLines(inbound, ledgermodels.RefundsPayableAccount(held.Provider, held.Currency), held.AmountMinor)); err != nil {
		return nil, false, err
	}
	refunded, err := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusRefunded).SetRefundedAt(service.Container.Now().UTC()).
		SetRefundedMinor(held.AmountMinor).ClearAutoReleaseAt().Save(ctx)
	return refunded, true, err
}

func (service EscrowService) partiallyRefundBuyerWalletInTransaction(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, refundMinor, sellerKeeps, commissionKept int64) (*ent.Escrow, error) {
	if held.WalletFundedAt == nil {
		return nil, ErrEscrowFundsNotSettled
	}
	now := service.Container.Now().UTC()
	resolved, err := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusPartiallyRefunded).SetRefundedAt(now).SetReleasedAt(now).
		SetReleaseTrigger("disputeResolved").SetRefundedMinor(refundMinor).SetReleasedToSellerMinor(sellerKeeps).ClearAutoReleaseAt().Save(ctx)
	if err != nil {
		return nil, err
	}
	locked := ledgermodels.WalletEscrowLockedAccount(held.BuyerUserID, held.ID.String(), held.Currency)
	lines := service.buyerRefundLines(held, locked, refundMinor)
	lines = append(lines, moveLines(locked, ledgermodels.WalletOutgoingAccount(held.BuyerUserID, held.Currency), held.AmountMinor-refundMinor)...)
	if err := service.postEscrowLines(ctx, transaction, held, "escrow-partial-refund:"+held.ID.String(), "escrow.partiallyUnlocked", "Order "+held.OrderReference+" partly refunded", lines); err != nil {
		return nil, err
	}
	return resolved, service.enqueueSellerShareMovements(ctx, transaction, held, sellerKeeps, held.AmountMinor-refundMinor-sellerKeeps, "partialRefund")
}
