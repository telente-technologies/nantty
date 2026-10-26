package services

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/modules/escrows/models"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
)

var ErrLegacyEscrowCustody = errors.New("this escrow was held in the previous provider's pooled account, which is no longer supported")

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
	if held.Status == escrow.StatusReleased || held.Status == escrow.StatusPartiallyRefunded {
		return EscrowSettlementResult{Escrow: held, AlreadySettled: true}, nil
	}
	if held.Status == escrow.StatusDisputed && trigger != "disputeResolved" {
		return EscrowSettlementResult{}, models.ErrEscrowFrozenByDispute
	}
	pending, err := service.HasScheduledRefund(ctx, client, held.ID)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	if pending {
		return EscrowSettlementResult{}, ErrRefundScheduled
	}
	if err := models.AssertEscrowTransitionAllowed(models.EscrowStatus(held.Status), models.EscrowReleased); err != nil {
		return EscrowSettlementResult{}, err
	}
	if !IsWalletLocked(held) {
		return EscrowSettlementResult{}, ErrLegacyEscrowCustody
	}
	released, err := service.releaseFromBuyerWalletInTransaction(ctx, transaction, held, trigger)
	if err != nil {
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
	if held.Status == escrow.StatusRefunded || held.Status == escrow.StatusClawedBack {
		return EscrowSettlementResult{Escrow: held, AlreadySettled: true}, nil
	}
	target := models.EscrowRefunded
	if held.Status == escrow.StatusReleased && held.PaymentMode == escrow.PaymentModeEscrow {
		target = models.EscrowClawedBack
	}
	if err := models.AssertEscrowTransitionAllowed(models.EscrowStatus(held.Status), target); err != nil {
		return EscrowSettlementResult{}, err
	}
	if isDirectSale(held) {
		return service.refundDirectSaleInTransaction(ctx, transaction, client, held, reason, actor)
	}
	if !IsWalletLocked(held) {
		return EscrowSettlementResult{}, ErrLegacyEscrowCustody
	}
	return service.refundWalletLockedEscrow(ctx, transaction, client, held, reason, actor)
}

func (service EscrowService) ResolveEscrowPartiallyInTransaction(ctx context.Context, transaction *sql.Tx, orderId string, refundMinor int64, reason string, actor EscrowActor) (EscrowSettlementResult, error) {
	client := service.Container.Client(transaction)
	held, err := service.LockEscrowForOrder(ctx, client, orderId)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	if held.Status == escrow.StatusPartiallyRefunded {
		if held.RefundedMinor != refundMinor {
			return EscrowSettlementResult{}, models.ErrEscrowAlreadyPartiallyRefunded
		}
		return EscrowSettlementResult{Escrow: held, AlreadySettled: true}, nil
	}
	if held.Status == escrow.StatusReleased {
		return EscrowSettlementResult{}, models.AssertEscrowTransitionAllowed(models.EscrowReleased, models.EscrowPartiallyRefunded)
	}
	if err := models.AssertEscrowTransitionAllowed(models.EscrowStatus(held.Status), models.EscrowPartiallyRefunded); err != nil {
		return EscrowSettlementResult{}, err
	}
	resolution, err := models.SplitPartialResolution(held.AmountMinor, refundMinor, held.CommissionBps)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	if !IsWalletLocked(held) {
		return EscrowSettlementResult{}, ErrLegacyEscrowCustody
	}
	commissionKept := models.CommissionKeptOnRemainder(held.CommissionMinor, held.AmountMinor, held.AmountMinor-resolution.RefundMinor)
	sellerKeeps := max(held.AmountMinor-resolution.RefundMinor-commissionKept-held.ProcessingFeeMinor, 0)
	resolved, err := service.partiallyRefundBuyerWalletInTransaction(ctx, transaction, held, resolution.RefundMinor, sellerKeeps, commissionKept)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	return service.finishSettlement(ctx, transaction, client, resolved, "partiallyRefunded", reason, actor, nil)
}

func (service EscrowService) refundWalletLockedEscrow(ctx context.Context, transaction *sql.Tx, client *ent.Client, held *ent.Escrow, reason string, actor EscrowActor) (EscrowSettlementResult, error) {
	if held.Status == escrow.StatusReleased || held.Status == escrow.StatusPartiallyRefunded {
		finalStatus := escrow.StatusClawedBack
		if held.Status == escrow.StatusPartiallyRefunded {
			finalStatus = escrow.StatusRefunded
		}
		clawed, err := service.clawBackReleasedEscrowInTransaction(ctx, transaction, held, reason, finalStatus)
		if err != nil {
			return EscrowSettlementResult{}, err
		}
		return service.finishSettlement(ctx, transaction, client, clawed, string(finalStatus), reason, actor, nil)
	}
	refunded, toCard, err := service.refundIntoBuyerWalletInTransaction(ctx, transaction, held, reason, actor)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	if !toCard {
		return service.finishSettlement(ctx, transaction, client, refunded, "refunded", reason, actor, nil)
	}
	refundId, err := service.requestProviderRefund(ctx, transaction, held, held.AmountMinor, "escrow-refund:"+held.ID.String(), reason)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	return service.finishSettlement(ctx, transaction, client, refunded, "refunded", reason, actor, &refundId)
}

func (service EscrowService) requestProviderRefund(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, amountMinor int64, reference, reason string) (uuid.UUID, error) {
	refund, err := service.Container.Payments.RequestRefundInTransaction(ctx, transaction, paymentmodels.RefundRequest{
		PaymentIntentId: held.PaymentIntentID, AmountMinor: amountMinor, Currency: held.Currency, Reference: reference, Reason: reason,
	})
	return refund.RefundId, err
}

func (service EscrowService) finishSettlement(ctx context.Context, transaction *sql.Tx, client *ent.Client, settled *ent.Escrow, eventType, detail string, actor EscrowActor, refundId *uuid.UUID) (EscrowSettlementResult, error) {
	if err := service.recordEscrowEvent(ctx, client, settled.ID, eventType, actor.Type, actor.Id, map[string]any{"detail": detail}); err != nil {
		return EscrowSettlementResult{}, err
	}
	data := escrowEventData(settled)
	if eventType == "refunded" || eventType == "partiallyRefunded" {
		data["refundDestination"] = refundDestination(refundId)
	}
	if err := service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "escrow."+eventType, settled.OrderID, service.Container.Now().UTC(), data); err != nil {
		return EscrowSettlementResult{}, err
	}
	return EscrowSettlementResult{Escrow: settled, RefundToSend: refundId}, nil
}

// refundDestination says where the buyer's money lands: a provider refund goes back to the card or account they paid with,
// every other escrow refund unlocks the money in their own Zudomart (Flutterwave) wallet.
func refundDestination(providerRefundId *uuid.UUID) string {
	if providerRefundId != nil {
		return "paymentMethod"
	}
	return "wallet"
}

func appendPositiveCredit(lines []ledgermodels.JournalLineRequest, account ledgermodels.AccountRef, amountMinor int64) []ledgermodels.JournalLineRequest {
	if amountMinor <= 0 {
		return lines
	}
	return append(lines, ledgermodels.JournalLineRequest{Account: account, Direction: ledgermodels.Credit, AmountMinor: amountMinor})
}
