package services

import (
	"context"
	"database/sql"
	"time"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/dispute"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/generated/ent/predicate"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	sellerbalances "zudomart/modules/ledger/src/modules/sellerBalances/services"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
)

func (service EscrowService) HandleProviderDispute(ctx context.Context, transaction *sql.Tx, notice paymentmodels.ProviderDisputeNotice) error {
	client := service.Container.Client(transaction)
	held, err := client.Escrow.Query().Where(escrow.PaymentIntentID(notice.PaymentIntentId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	details := map[string]any{"providerDisputeId": notice.ProviderDisputeId, "status": notice.Status, "reason": notice.Reason}
	switch notice.Status {
	case "won", "closed":
		err = service.resumeEscrowAfterChargebackWon(ctx, client, held)
	case "lost":
		if IsWalletLocked(held) {
			err = service.recoverLostChargebackFromWallets(ctx, transaction, held, notice)
		} else {
			err = service.settleEscrowForLostChargeback(ctx, transaction, held, notice)
		}
	default:
		err = service.freezeEscrowForChargeback(ctx, client, held)
	}
	if err != nil {
		return err
	}
	if err := service.recordEscrowEvent(ctx, client, held.ID, "chargeback_"+notice.Status, "provider", notice.ProviderDisputeId, details); err != nil {
		return err
	}
	return service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "escrow.chargeback", held.OrderID, notice.OccurredAt, escrowEventData(held))
}

func (service EscrowService) freezeEscrowForChargeback(ctx context.Context, client *ent.Client, held *ent.Escrow) error {
	if held.Status != escrow.StatusHeld {
		return nil
	}
	freeze := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusDisputed).ClearAutoReleaseAt()
	if held.AutoReleaseAt != nil {
		freeze.SetPausedReleaseRemainingSeconds(int64(max(held.AutoReleaseAt.Sub(service.Container.Now()), 0).Seconds()))
	}
	return freeze.Exec(ctx)
}

func (service EscrowService) resumeEscrowAfterChargebackWon(ctx context.Context, client *ent.Client, held *ent.Escrow) error {
	if held.Status != escrow.StatusDisputed {
		return nil
	}
	activeBuyerDispute, err := held.QueryDisputes().Where(isActiveBuyerDispute()).Exist(ctx)
	if err != nil || activeBuyerDispute {
		return err
	}
	update := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(escrow.StatusHeld).ClearPausedReleaseRemainingSeconds()
	now := service.Container.Now().UTC()
	switch {
	case held.PausedReleaseRemainingSeconds != nil:
		update.SetAutoReleaseAt(now.Add(time.Duration(*held.PausedReleaseRemainingSeconds) * time.Second))
	case held.DeliveredAt != nil:
		update.SetAutoReleaseAt(now.Add(service.Container.Policy(ctx).AutoReleasePeriod))
	}
	return update.Exec(ctx)
}

func (service EscrowService) settleEscrowForLostChargeback(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, notice paymentmodels.ProviderDisputeNotice) error {
	disputed := notice.AmountMinor
	if disputed <= 0 || disputed > held.AmountMinor {
		disputed = held.AmountMinor
	}
	reference := "chargeback-lost:" + held.ID.String()
	metadata := map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "providerDisputeId": notice.ProviderDisputeId}
	providerHeld := ledgermodels.PlatformProviderBalanceAccount(held.Provider, held.Currency)
	now := service.Container.Now().UTC()
	status := escrow.StatusRefunded
	if disputed < held.AmountMinor {
		status = escrow.StatusPartiallyRefunded
	}
	if held.Status == escrow.StatusReleased {
		if _, err := service.Container.Sellers.TakeSellerFundsForRefundInTransaction(ctx, transaction, sellerbalances.SellerRefundDebit{
			SellerUserId: held.SellerUserID, Currency: held.Currency, AmountMinor: disputed, PreferredSourceReference: OrderCreditReference(held.OrderID),
			Reference: reference, Description: "Chargeback lost on order " + held.OrderReference, Metadata: metadata, CreditAccount: providerHeld,
		}); err != nil {
			return err
		}
		return held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(status).SetRefundedAt(now).SetRefundedMinor(disputed).Exec(ctx)
	}
	if held.Status != escrow.StatusHeld && held.Status != escrow.StatusDisputed {
		return nil
	}
	escrowed := held.SellerAmountMinor
	lines := paymentservices.AppendPositiveLine(nil, escrowHoldingAccount(held), ledgermodels.Debit, escrowed)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.SellerDebtAccount(held.SellerUserID, held.Currency), ledgermodels.Debit, max(disputed-escrowed, 0))
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.PlatformFeesUnearnedAccount(held.Currency), ledgermodels.Debit, held.CommissionMinor)
	lines = paymentservices.AppendPositiveLine(lines, providerHeld, ledgermodels.Credit, disputed)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.SellerPendingAccount(held.SellerUserID, held.Currency), ledgermodels.Credit, max(escrowed-disputed, 0))
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.PlatformEscrowFeeRevenueAccount(held.Currency), ledgermodels.Credit, held.CommissionMinor)
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "escrow.chargebackLost", Description: "Chargeback lost on order " + held.OrderReference, Metadata: metadata, Lines: lines,
	}); err != nil {
		return err
	}
	if err := service.Container.Sellers.ScheduleLockedCreditInTransaction(ctx, transaction, sellerbalances.LockedSellerCredit{
		SellerUserId: held.SellerUserID, Currency: held.Currency, AmountMinor: max(escrowed-disputed, 0),
		SourceReference: OrderCreditReference(held.OrderID), AvailableAt: now.Add(service.Container.Policy(ctx).SellerCreditHoldPeriod),
	}); err != nil {
		return err
	}
	return held.Update().Where(escrow.Version(held.Version)).AddVersion(1).SetStatus(status).SetRefundedAt(now).SetRefundedMinor(disputed).
		SetReleasedToSellerMinor(max(escrowed-disputed, 0)).ClearAutoReleaseAt().Exec(ctx)
}

func isActiveBuyerDispute() predicate.Dispute {
	return dispute.StatusIn(dispute.StatusAwaitingSeller, dispute.StatusUnderReview)
}
