package services

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

type sellerTake struct {
	fromHold, fromAvailable, shortfall int64
}

func (service EscrowService) takeFromSellerWallet(ctx context.Context, transaction *sql.Tx, sellerUserId, currency string, wanted int64) (sellerTake, error) {
	if err := paymentservices.LockUserWalletMoney(ctx, transaction, sellerUserId); err != nil {
		return sellerTake{}, err
	}
	if _, err := service.Container.Payments.FindProviderWallet(ctx, transaction, sellerUserId); err != nil {
		return sellerTake{shortfall: wanted}, nil
	}
	hold, available := ledgermodels.WalletDepositHoldAccount(sellerUserId, currency), ledgermodels.WalletAvailableAccount(sellerUserId, currency)
	balances, err := service.Container.Ledger.ReadAccountBalances(ctx, transaction, []ledgermodels.AccountRef{hold, available})
	if err != nil {
		return sellerTake{}, err
	}
	take := sellerTake{fromAvailable: min(wanted, max(balances[available.Key()], 0))}
	take.fromHold = min(wanted-take.fromAvailable, max(balances[hold.Key()], 0))
	take.shortfall = wanted - take.fromAvailable - take.fromHold
	return take, nil
}

// clawBackReleasedEscrowInTransaction refunds the buyer only the seller's portion: once the seller was paid, Nantty keeps its escrow fee and the processing fee.
func (service EscrowService) clawBackReleasedEscrowInTransaction(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, reason string, finalStatus escrow.Status) (*ent.Escrow, error) {
	take, err := service.takeFromSellerWallet(ctx, transaction, held.SellerUserID, held.Currency, held.ReleasedToSellerMinor)
	if err != nil {
		return nil, err
	}
	taken := take.fromHold + take.fromAvailable
	inbound := ledgermodels.WalletInboundEscrowAccount(held.BuyerUserID, held.ID.String(), held.Currency)
	lines := paymentservices.AppendPositiveLine(nil, ledgermodels.WalletDepositHoldAccount(held.SellerUserID, held.Currency), ledgermodels.Debit, take.fromHold)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletAvailableAccount(held.SellerUserID, held.Currency), ledgermodels.Debit, take.fromAvailable)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletOutgoingAccount(held.SellerUserID, held.Currency), ledgermodels.Credit, taken)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletDebtAccount(held.SellerUserID, held.Currency), ledgermodels.Debit, take.shortfall)
	lines = paymentservices.AppendPositiveLine(lines, inbound, ledgermodels.Credit, take.shortfall)
	if err := service.postEscrowLines(ctx, transaction, held, "escrow-clawback:"+held.ID.String(), "escrow.clawedBack", "Released order "+held.OrderReference+" clawed back for the buyer", lines); err != nil {
		return nil, err
	}
	metadata := map[string]any{"escrowId": held.ID.String(), "reason": reason}
	if taken > 0 {
		if _, err := service.Container.Payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
			Kind: paymentmodels.MovementClawback, SubjectId: held.ID.String(), UserId: held.BuyerUserID, FromUserId: held.SellerUserID, ToUserId: held.BuyerUserID,
			AmountMinor: taken, Currency: held.Currency, Metadata: metadata,
		}); err != nil {
			return nil, err
		}
	}
	if err := service.enqueueClawbackTopUp(ctx, transaction, held, take.shortfall, metadata); err != nil {
		return nil, err
	}
	if take.shortfall > 0 {
		service.Container.Payments.RecordPaymentAlertMetric(ctx, "walletDebt", "userId", held.SellerUserID, "debtMinor", take.shortfall, "escrowId", held.ID.String())
		if err := service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "wallet.debtRecorded", held.ID.String(), service.Container.Now().UTC(), map[string]any{
			"userId": held.SellerUserID, "escrowId": held.ID.String(), "debt": map[string]any{"amountMinor": take.shortfall, "currency": held.Currency},
		}); err != nil {
			return nil, err
		}
	}
	return held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(finalStatus).SetRefundedAt(service.Container.Now().UTC()).
		SetRefundedMinor(held.RefundedMinor + held.ReleasedToSellerMinor).Save(ctx)
}

func (service EscrowService) enqueueClawbackTopUp(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, amountMinor int64, metadata map[string]any) error {
	if amountMinor <= 0 {
		return nil
	}
	_, err := service.Container.Payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
		Kind: paymentmodels.MovementClawbackTopUp, SubjectId: held.ID.String(), UserId: held.BuyerUserID, ToUserId: held.BuyerUserID,
		AmountMinor: amountMinor, Currency: held.Currency, Metadata: metadata,
	})
	return err
}
