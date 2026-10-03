package services

import (
	"context"
	"database/sql"
	"log/slog"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/modules/escrows/models"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
)

type EscrowActor struct {
	Type string
	Id   string
}

var SystemActor = EscrowActor{Type: "system"}

type EscrowSettlementResult struct {
	Escrow         *ent.Escrow
	RefundToSend   *uuid.UUID
	AlreadySettled bool
}

func (service EscrowService) ReleaseEscrowInTransaction(ctx context.Context, transaction *sql.Tx, orderId, trigger string, actor EscrowActor) (EscrowSettlementResult, error) {
	client := service.Container.Client(transaction)
	held, err := service.LockEscrowForOrder(ctx, client, orderId)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	if held.Status == escrow.StatusReleased {
		return EscrowSettlementResult{Escrow: held, AlreadySettled: true}, nil
	}
	if held.Status == escrow.StatusDisputed && trigger != "disputeResolved" {
		return EscrowSettlementResult{}, models.ErrEscrowFrozenByDispute
	}
	if err := models.AssertEscrowTransitionAllowed(models.EscrowStatus(held.Status), models.EscrowReleased); err != nil {
		return EscrowSettlementResult{}, err
	}
	now := service.Container.Now().UTC()
	update := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).
		SetStatus(escrow.StatusReleased).SetReleasedAt(now).SetReleaseTrigger(trigger).SetReleasedToSellerMinor(held.SellerAmountMinor).ClearAutoReleaseAt()
	if trigger == "buyerConfirmed" {
		update.SetBuyerConfirmedAt(now)
	}
	released, err := update.Save(ctx)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.EscrowHoldingAccount(held.ID.String(), held.Currency), Direction: ledgermodels.Debit, AmountMinor: held.AmountMinor},
	}
	lines = appendPositiveCredit(lines, ledgermodels.UserWalletAccount(held.SellerUserID, held.Currency), held.SellerAmountMinor)
	lines = appendPositiveCredit(lines, ledgermodels.PlatformCommissionRevenueAccount(held.Currency), held.CommissionMinor)
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "escrow-release:" + held.ID.String(), Kind: "escrow.released", Description: "Order " + held.OrderReference + " released to seller",
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "trigger": trigger, "actorType": actor.Type, "actorId": actor.Id},
		Lines:    lines,
	}); err != nil {
		return EscrowSettlementResult{}, err
	}
	return service.finishSettlement(ctx, transaction, client, released, "released", trigger, actor, nil)
}

func (service EscrowService) RefundEscrowInTransaction(ctx context.Context, transaction *sql.Tx, orderId, reason string, actor EscrowActor) (EscrowSettlementResult, error) {
	client := service.Container.Client(transaction)
	held, err := service.LockEscrowForOrder(ctx, client, orderId)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	if held.Status == escrow.StatusRefunded {
		return EscrowSettlementResult{Escrow: held, AlreadySettled: true}, nil
	}
	if err := models.AssertEscrowTransitionAllowed(models.EscrowStatus(held.Status), models.EscrowRefunded); err != nil {
		return EscrowSettlementResult{}, err
	}
	now := service.Container.Now().UTC()
	refunded, err := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).
		SetStatus(escrow.StatusRefunded).SetRefundedAt(now).SetRefundedMinor(held.AmountMinor).ClearAutoReleaseAt().Save(ctx)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	refundId, err := service.moveEscrowToBuyerRefund(ctx, transaction, held, held.AmountMinor, 0, 0, "escrow-refund:"+held.ID.String(), reason, actor)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	return service.finishSettlement(ctx, transaction, client, refunded, "refunded", reason, actor, &refundId)
}

func (service EscrowService) ResolveEscrowPartiallyInTransaction(ctx context.Context, transaction *sql.Tx, orderId string, refundMinor int64, reason string, actor EscrowActor) (EscrowSettlementResult, error) {
	client := service.Container.Client(transaction)
	held, err := service.LockEscrowForOrder(ctx, client, orderId)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	if held.Status == escrow.StatusPartiallyRefunded {
		return EscrowSettlementResult{Escrow: held, AlreadySettled: true}, nil
	}
	if err := models.AssertEscrowTransitionAllowed(models.EscrowStatus(held.Status), models.EscrowPartiallyRefunded); err != nil {
		return EscrowSettlementResult{}, err
	}
	resolution, err := models.SplitPartialResolution(held.AmountMinor, refundMinor, held.CommissionBps)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	now := service.Container.Now().UTC()
	resolved, err := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).
		SetStatus(escrow.StatusPartiallyRefunded).SetRefundedAt(now).SetReleasedAt(now).SetReleaseTrigger("disputeResolved").
		SetRefundedMinor(resolution.RefundMinor).SetReleasedToSellerMinor(resolution.SellerMinor).ClearAutoReleaseAt().Save(ctx)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	refundId, err := service.moveEscrowToBuyerRefund(ctx, transaction, held, resolution.RefundMinor, resolution.SellerMinor, resolution.CommissionMinor, "escrow-partial-refund:"+held.ID.String(), reason, actor)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	return service.finishSettlement(ctx, transaction, client, resolved, "partiallyRefunded", reason, actor, &refundId)
}

func (service EscrowService) moveEscrowToBuyerRefund(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, refundMinor, sellerMinor, commissionMinor int64, reference, reason string, actor EscrowActor) (uuid.UUID, error) {
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.EscrowHoldingAccount(held.ID.String(), held.Currency), Direction: ledgermodels.Debit, AmountMinor: held.AmountMinor},
		{Account: ledgermodels.RefundsPayableAccount(held.Provider, held.Currency), Direction: ledgermodels.Credit, AmountMinor: refundMinor},
	}
	lines = appendPositiveCredit(lines, ledgermodels.UserWalletAccount(held.SellerUserID, held.Currency), sellerMinor)
	lines = appendPositiveCredit(lines, ledgermodels.PlatformCommissionRevenueAccount(held.Currency), commissionMinor)
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "escrow.refunded", Description: "Order " + held.OrderReference + " refunded to buyer",
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "reason": reason, "actorType": actor.Type, "actorId": actor.Id},
		Lines:    lines,
	}); err != nil {
		return uuid.Nil, err
	}
	refund, err := service.Container.Payments.RequestRefundInTransaction(ctx, transaction, paymentmodels.RefundRequest{
		PaymentIntentId: held.PaymentIntentID, AmountMinor: refundMinor, Currency: held.Currency, Reference: reference, Reason: reason,
	})
	return refund.RefundId, err
}

func (service EscrowService) finishSettlement(ctx context.Context, transaction *sql.Tx, client *ent.Client, settled *ent.Escrow, eventType, detail string, actor EscrowActor, refundId *uuid.UUID) (EscrowSettlementResult, error) {
	if err := service.recordEscrowEvent(ctx, client, settled.ID, eventType, actor.Type, actor.Id, map[string]any{"detail": detail}); err != nil {
		return EscrowSettlementResult{}, err
	}
	if err := service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "escrow."+eventType, settled.OrderID, service.Container.Now().UTC(), escrowEventData(settled)); err != nil {
		return EscrowSettlementResult{}, err
	}
	return EscrowSettlementResult{Escrow: settled, RefundToSend: refundId}, nil
}

func (service EscrowService) SendRefundToProviderAfterCommit(ctx context.Context, result EscrowSettlementResult) {
	if result.RefundToSend == nil {
		return
	}
	if err := service.Container.Payments.SendPendingRefundToProvider(ctx, *result.RefundToSend); err != nil {
		service.Container.Resources.Logger.WarnContext(ctx, "refund could not be sent to the provider; it stays pending for retry", slog.String("refundId", result.RefundToSend.String()), slog.Any("error", err))
	}
}

func appendPositiveCredit(lines []ledgermodels.JournalLineRequest, account ledgermodels.AccountRef, amountMinor int64) []ledgermodels.JournalLineRequest {
	if amountMinor <= 0 {
		return lines
	}
	return append(lines, ledgermodels.JournalLineRequest{Account: account, Direction: ledgermodels.Credit, AmountMinor: amountMinor})
}
