package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/generated/ent/pendingrefund"
	"zudomart/modules/escrow/src/modules/escrows/dtos"
	"zudomart/modules/ledger/src/databases"
	"zudomart/platform/httpserver"
)

var ErrRefundScheduled = httpserver.NewApiError(http.StatusConflict, "REFUND_SCHEDULED",
	"A refund is scheduled for this order and runs once the card payment settles, so the order cannot be released to the seller.")

const pendingRefundMaxAttempts = 20

var errEscrowAwaitingFunds = errors.New("escrow funds have not settled yet")

type PendingRefundRequest struct {
	RequestKey  string
	AmountMinor int64
	Reason      string
	Actor       EscrowActor
}

func (service EscrowService) ScheduleRefundUntilFundsSettleInTransaction(ctx context.Context, transaction *sql.Tx, orderId string, request PendingRefundRequest) (EscrowSettlementResult, error) {
	client := service.Container.Client(transaction)
	held, err := service.LockEscrowForOrder(ctx, client, orderId)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	exists, err := client.PendingRefund.Query().Where(pendingrefund.EscrowID(held.ID), pendingrefund.RequestKey(request.RequestKey)).Exist(ctx)
	if err != nil || exists {
		return EscrowSettlementResult{Escrow: held, AlreadySettled: exists}, err
	}
	now := service.Container.Now().UTC()
	scheduled, err := client.PendingRefund.Create().SetEscrowID(held.ID).SetOrderID(held.OrderID).SetRequestKey(request.RequestKey).
		SetAmountMinor(request.AmountMinor).SetCurrency(held.Currency).SetFull(request.AmountMinor == held.AmountMinor).
		SetReason(truncateText(request.Reason, 300)).SetActorType(request.Actor.Type).SetActorID(request.Actor.Id).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	details := map[string]any{"pendingRefundId": scheduled.ID.String(), "amountMinor": scheduled.AmountMinor, "reason": scheduled.Reason}
	if err := service.recordEscrowEvent(ctx, client, held.ID, "refundScheduled", request.Actor.Type, request.Actor.Id, details); err != nil {
		return EscrowSettlementResult{}, err
	}
	data := escrowEventData(held)
	data["pendingRefund"] = map[string]any{"id": scheduled.ID.String(), "amountMinor": scheduled.AmountMinor, "currency": scheduled.Currency, "full": scheduled.Full}
	data["reason"] = scheduled.Reason
	if err := service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "escrow.refundScheduled", held.OrderID, now, data); err != nil {
		return EscrowSettlementResult{}, err
	}
	return EscrowSettlementResult{Escrow: held}, nil
}

func (service EscrowService) HasScheduledRefund(ctx context.Context, client *ent.Client, escrowId uuid.UUID) (bool, error) {
	return client.PendingRefund.Query().Where(pendingrefund.EscrowID(escrowId), pendingrefund.StatusEQ(pendingrefund.StatusScheduled)).Exist(ctx)
}

func (service EscrowService) ScheduledRefundView(ctx context.Context, client *ent.Client, escrowId uuid.UUID) (*dtos.ScheduledRefundDto, error) {
	rows, err := client.PendingRefund.Query().Where(pendingrefund.EscrowID(escrowId), pendingrefund.StatusEQ(pendingrefund.StatusScheduled)).
		Order(ent.Asc(pendingrefund.FieldCreatedAt)).All(ctx)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	view := &dtos.ScheduledRefundDto{Amount: money(0, rows[0].Currency), Reason: rows[0].Reason, ScheduledAt: rows[0].CreatedAt, Status: "scheduled"}
	for _, row := range rows {
		view.Amount.AmountMinor = max(view.Amount.AmountMinor, row.AmountMinor)
	}
	return view, nil
}

func (service EscrowService) ExecuteScheduledRefundsInTransaction(ctx context.Context, transaction *sql.Tx, escrowId uuid.UUID) (int, error) {
	client := service.Container.Client(transaction)
	scheduled, err := client.PendingRefund.Query().Where(pendingrefund.EscrowID(escrowId), pendingrefund.StatusEQ(pendingrefund.StatusScheduled)).
		Order(ent.Asc(pendingrefund.FieldCreatedAt), ent.Asc(pendingrefund.FieldID)).ForUpdate().All(ctx)
	if err != nil {
		return 0, err
	}
	executed := 0
	for _, refund := range scheduled {
		if _, err := transaction.ExecContext(ctx, "SAVEPOINT escrow_pending_refund"); err != nil {
			return executed, err
		}
		outcome, runErr := service.executePendingRefund(ctx, transaction, refund)
		if errors.Is(runErr, errEscrowAwaitingFunds) {
			_, err := transaction.ExecContext(ctx, "RELEASE SAVEPOINT escrow_pending_refund")
			return executed, err
		}
		if runErr != nil {
			if databases.IsRetryablePostgresConflict(runErr) {
				return executed, runErr
			}
			if _, err := transaction.ExecContext(ctx, "ROLLBACK TO SAVEPOINT escrow_pending_refund"); err != nil {
				return executed, errors.Join(runErr, err)
			}
			failed, err := service.recordPendingRefundFailure(ctx, transaction, refund, runErr)
			if err != nil {
				return executed, err
			}
			if !failed {
				_, err := transaction.ExecContext(ctx, "RELEASE SAVEPOINT escrow_pending_refund")
				return executed, err
			}
		} else if outcome == pendingrefund.StatusExecuted {
			executed++
		}
		if _, err := transaction.ExecContext(ctx, "RELEASE SAVEPOINT escrow_pending_refund"); err != nil {
			return executed, err
		}
	}
	return executed, nil
}

func (service EscrowService) executePendingRefund(ctx context.Context, transaction *sql.Tx, refund *ent.PendingRefund) (pendingrefund.Status, error) {
	client := service.Container.Client(transaction)
	held, err := client.Escrow.Query().Where(escrow.ID(refund.EscrowID)).ForUpdate().Only(ctx)
	if err != nil {
		return "", err
	}
	if held.WalletFundedAt == nil {
		return "", errEscrowAwaitingFunds
	}
	actor := EscrowActor{Type: refund.ActorType, Id: refund.ActorID}
	outcome := pendingrefund.StatusExecuted
	switch {
	case held.Status == escrow.StatusRefunded || held.Status == escrow.StatusClawedBack:
		outcome = pendingrefund.StatusSuperseded
	case refund.Full:
		_, err = service.RefundEscrowInTransaction(ctx, transaction, held.OrderID, refund.Reason, actor)
	case held.Status == escrow.StatusPartiallyRefunded && held.RefundedMinor == refund.AmountMinor:
		outcome = pendingrefund.StatusSuperseded
	default:
		_, err = service.ResolveEscrowPartiallyInTransaction(ctx, transaction, held.OrderID, refund.AmountMinor, refund.Reason, actor)
	}
	if err != nil {
		return "", err
	}
	now := service.Container.Now().UTC()
	if err := refund.Update().SetStatus(outcome).SetExecutedAt(now).AddAttempts(1).SetLastError("").Exec(ctx); err != nil {
		return "", err
	}
	return outcome, service.recordEscrowEvent(ctx, client, held.ID, "scheduledRefund"+capitalized(string(outcome)), "system", "",
		map[string]any{"pendingRefundId": refund.ID.String(), "amountMinor": refund.AmountMinor})
}

func (service EscrowService) recordPendingRefundFailure(ctx context.Context, transaction *sql.Tx, refund *ent.PendingRefund, cause error) (bool, error) {
	attempts := refund.Attempts + 1
	update := refund.Update().SetAttempts(attempts).SetLastError(truncateText(cause.Error(), 500))
	var apiError *httpserver.ApiError
	permanent := errors.As(cause, &apiError) && apiError.Status < http.StatusInternalServerError
	if permanent || attempts >= pendingRefundMaxAttempts {
		update.SetStatus(pendingrefund.StatusFailed)
		service.Container.Payments.RecordPaymentAlertMetric(ctx, "scheduledRefundFailed", "orderId", refund.OrderID, "pendingRefundId", refund.ID.String(), "reason", cause.Error())
		if err := service.recordEscrowEvent(ctx, service.Container.Client(transaction), refund.EscrowID, "scheduledRefundFailed", "system", "",
			map[string]any{"pendingRefundId": refund.ID.String(), "error": truncateText(cause.Error(), 500)}); err != nil {
			return false, err
		}
	}
	service.Container.Resources.Logger.WarnContext(ctx, "scheduled refund did not run", "orderId", refund.OrderID, "pendingRefundId", refund.ID.String(), "attempts", attempts, "error", cause)
	return permanent || attempts >= pendingRefundMaxAttempts, update.Exec(ctx)
}

func truncateText(text string, maximum int) string {
	runes := []rune(text)
	if len(runes) > maximum {
		return string(runes[:maximum])
	}
	return text
}

func capitalized(text string) string {
	if text == "" {
		return text
	}
	return string(text[0]-'a'+'A') + text[1:]
}
