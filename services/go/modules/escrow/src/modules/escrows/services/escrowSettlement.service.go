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
	sellerbalances "zudomart/modules/ledger/src/modules/sellerBalances/services"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
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
	fromEscrow := ledgermodels.JournalLineRequest{Account: ledgermodels.SellerEscrowAccount(held.SellerUserID, held.ID.String(), held.Currency), Direction: ledgermodels.Debit, AmountMinor: held.SellerAmountMinor}
	if err := service.creditSellerAndPlatform(ctx, transaction, held, fromEscrow, ledgermodels.PlatformFeesUnearnedAccount(held.Currency), "escrow-release:"+held.ID.String(), "Order "+held.OrderReference+" released to seller"); err != nil {
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
	wasReleased := held.Status == escrow.StatusReleased
	now := service.Container.Now().UTC()
	refunded, err := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).
		SetStatus(escrow.StatusRefunded).SetRefundedAt(now).SetRefundedMinor(held.AmountMinor).ClearAutoReleaseAt().Save(ctx)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	reference := "escrow-refund:" + held.ID.String()
	if wasReleased {
		err = service.takeReleasedFundsBackForRefund(ctx, transaction, held, reference, reason, actor)
	} else {
		err = service.postEscrowSplit(ctx, transaction, held, held.AmountMinor, 0, 0, reference, reason, actor)
	}
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	refundId, err := service.requestProviderRefund(ctx, transaction, held, held.AmountMinor, reference, reason)
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
	now := service.Container.Now().UTC()
	resolved, err := held.Update().Where(escrow.Version(held.Version)).AddVersion(1).
		SetStatus(escrow.StatusPartiallyRefunded).SetRefundedAt(now).SetReleasedAt(now).SetReleaseTrigger("disputeResolved").
		SetRefundedMinor(resolution.RefundMinor).SetReleasedToSellerMinor(max(held.AmountMinor-resolution.RefundMinor-min(resolution.CommissionMinor, held.CommissionMinor)-held.ProcessingFeeMinor, 0)).ClearAutoReleaseAt().Save(ctx)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	reference := "escrow-partial-refund:" + held.ID.String()
	commissionKept := min(resolution.CommissionMinor, held.CommissionMinor)
	sellerKeeps := max(held.AmountMinor-resolution.RefundMinor-commissionKept-held.ProcessingFeeMinor, 0)
	if err := service.postEscrowSplit(ctx, transaction, held, resolution.RefundMinor, sellerKeeps, commissionKept, reference, reason, actor); err != nil {
		return EscrowSettlementResult{}, err
	}
	if err := service.Container.Sellers.ScheduleLockedCreditInTransaction(ctx, transaction, sellerbalances.LockedSellerCredit{
		SellerUserId: held.SellerUserID, Currency: held.Currency, AmountMinor: sellerKeeps,
		SourceReference: OrderCreditReference(held.OrderID), AvailableAt: now.Add(service.Container.Policy(ctx).SellerCreditHoldPeriod),
	}); err != nil {
		return EscrowSettlementResult{}, err
	}
	refundId, err := service.requestProviderRefund(ctx, transaction, held, resolution.RefundMinor, reference, reason)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	return service.finishSettlement(ctx, transaction, client, resolved, "partiallyRefunded", reason, actor, &refundId)
}

func (service EscrowService) postEscrowSplit(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, refundMinor, sellerMinor, commissionKeptMinor int64, reference, reason string, actor EscrowActor) error {
	absorbedProcessingFee := refundMinor + sellerMinor + commissionKeptMinor - held.SellerAmountMinor - held.CommissionMinor
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.SellerEscrowAccount(held.SellerUserID, held.ID.String(), held.Currency), Direction: ledgermodels.Debit, AmountMinor: held.SellerAmountMinor},
	}
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.PlatformFeesUnearnedAccount(held.Currency), ledgermodels.Debit, held.CommissionMinor)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.RefundedProcessingFeesExpenseAccount(held.Currency), ledgermodels.Debit, absorbedProcessingFee)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.PlatformEscrowFeeRevenueAccount(held.Currency), ledgermodels.Credit, commissionKeptMinor)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.RefundsPayableAccount(held.Provider, held.Currency), ledgermodels.Credit, refundMinor)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.SellerPendingAccount(held.SellerUserID, held.Currency), ledgermodels.Credit, sellerMinor)
	_, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "escrow.refunded", Description: "Order " + held.OrderReference + " refunded to buyer",
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "reason": reason, "actorType": actor.Type, "actorId": actor.Id, "absorbedProcessingFeeMinor": absorbedProcessingFee},
		Lines:    lines,
	})
	return err
}

func (service EscrowService) takeReleasedFundsBackForRefund(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, reference, reason string, actor EscrowActor) error {
	metadata := map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "reason": reason, "actorType": actor.Type, "actorId": actor.Id}
	refundsPayable := ledgermodels.RefundsPayableAccount(held.Provider, held.Currency)
	if held.PaymentMode == escrow.PaymentModeDirect {
		_, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: reference + ":sellerDebt", Kind: "directPayment.refundedFromPlatform", Description: "Refund of direct order " + held.OrderReference + " recovered from the seller", Metadata: metadata,
			Lines: paymentservices.AppendPositiveLine([]ledgermodels.JournalLineRequest{
				{Account: ledgermodels.SellerDebtAccount(held.SellerUserID, held.Currency), Direction: ledgermodels.Debit, AmountMinor: held.SellerAmountMinor},
				{Account: refundsPayable, Direction: ledgermodels.Credit, AmountMinor: held.AmountMinor},
			}, ledgermodels.RefundedProcessingFeesExpenseAccount(held.Currency), ledgermodels.Debit, held.AmountMinor-held.SellerAmountMinor),
		})
		return err
	}
	if _, err := service.Container.Sellers.TakeSellerFundsForRefundInTransaction(ctx, transaction, sellerbalances.SellerRefundDebit{
		SellerUserId: held.SellerUserID, Currency: held.Currency, AmountMinor: held.SellerAmountMinor, PreferredSourceReference: OrderCreditReference(held.OrderID),
		Reference: reference + ":seller", Description: "Refund of order " + held.OrderReference, Metadata: metadata, CreditAccount: refundsPayable,
	}); err != nil {
		return err
	}
	feesReturned := held.CommissionMinor + held.ProcessingFeeMinor
	if feesReturned == 0 {
		return nil
	}
	lines := paymentservices.AppendPositiveLine(nil, ledgermodels.PlatformEscrowFeeRevenueAccount(held.Currency), ledgermodels.Debit, held.CommissionMinor)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.RefundedProcessingFeesExpenseAccount(held.Currency), ledgermodels.Debit, held.ProcessingFeeMinor)
	lines = append(lines, ledgermodels.JournalLineRequest{Account: refundsPayable, Direction: ledgermodels.Credit, AmountMinor: feesReturned})
	_, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference + ":fees", Kind: "escrowFee.returnedForRefund", Description: "Escrow and processing fees returned for order " + held.OrderReference, Metadata: metadata, Lines: lines,
	})
	return err
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
