package services

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/platform/httpserver"
)

var ErrEscrowNotUnderReview = httpserver.NewApiError(http.StatusConflict, "ESCROW_NOT_UNDER_REVIEW", "This order is not waiting for a staff review.")

func IsUnderUndeliveredReview(held *ent.Escrow) bool {
	return held.Status == escrow.StatusHeld && held.DeliveredAt == nil && held.UndeliveredReviewAt != nil
}

func (service EscrowService) moveUndeliveredEscrowToStaffReviewInTransaction(ctx context.Context, transaction *sql.Tx, held *ent.Escrow) error {
	now := service.Container.Now().UTC()
	updated, err := held.Update().AddVersion(1).ClearAutoReleaseAt().SetUndeliveredReviewAt(now).Save(ctx)
	if err != nil {
		return err
	}
	client := service.Container.Client(transaction)
	if err := service.recordEscrowEvent(ctx, client, held.ID, "undeliveredReview", "system", "", map[string]any{"heldSince": held.CreatedAt}); err != nil {
		return err
	}
	service.Container.Payments.RecordPaymentAlertMetric(ctx, "escrowUndeliveredReview", "escrowId", held.ID.String(), "orderId", held.OrderID)
	return service.Container.Outbox.EnqueueInTransaction(ctx, transaction, "escrow.underReview", updated.OrderID, now, escrowEventData(updated))
}

func (service EscrowService) ReleaseEscrowAfterStaffReviewInTransaction(ctx context.Context, transaction *sql.Tx, orderId, reason string, actor EscrowActor) (EscrowSettlementResult, error) {
	held, err := service.LockEscrowForOrder(ctx, service.Container.Client(transaction), orderId)
	if err != nil {
		return EscrowSettlementResult{}, err
	}
	if held.Status == escrow.StatusHeld && !IsUnderUndeliveredReview(held) {
		return EscrowSettlementResult{}, ErrEscrowNotUnderReview
	}
	result, err := service.ReleaseEscrowInTransaction(ctx, transaction, orderId, "staffReview", actor)
	if err != nil || result.AlreadySettled {
		return result, err
	}
	return result, service.RecordStaffDecisionInTransaction(ctx, transaction, result.Escrow, "release", reason, actor)
}

func (service EscrowService) RecordStaffDecisionInTransaction(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, decision, reason string, actor EscrowActor) error {
	return service.recordEscrowEvent(ctx, service.Container.Client(transaction), held.ID, "staffDecision", actor.Type, actor.Id, map[string]any{
		"decision": decision, "reason": reason, "afterUndeliveredReview": held.UndeliveredReviewAt != nil && held.DeliveredAt == nil,
	})
}

func (service EscrowService) ListEscrowsUnderUndeliveredReview(ctx context.Context, limit int, afterId *uuid.UUID) ([]*ent.Escrow, error) {
	request := service.Container.Client(service.Container.Resources.Database).Escrow.Query().
		Where(escrow.StatusEQ(escrow.StatusHeld), escrow.DeliveredAtIsNil(), escrow.UndeliveredReviewAtNotNil())
	if afterId != nil {
		request.Where(escrow.IDGT(*afterId))
	}
	return request.Order(ent.Asc(escrow.FieldID)).Limit(limit).All(ctx)
}

// BackfillUndeliveredReviewDeadlines gives escrows held before the deadline was set at hold their review deadline (held + window).
func BackfillUndeliveredReviewDeadlines(ctx context.Context, database *sql.DB, schema string, window time.Duration, dryRun bool) (int64, error) {
	where := ` FROM "` + schema + `".escrows WHERE status = 'held' AND payment_mode = 'escrow' AND auto_release_at IS NULL AND delivered_at IS NULL AND undelivered_review_at IS NULL`
	if dryRun {
		var count int64
		return count, database.QueryRowContext(ctx, `SELECT count(*)`+where).Scan(&count)
	}
	result, err := database.ExecContext(ctx, `UPDATE "`+schema+`".escrows SET auto_release_at = created_at + make_interval(secs => $1), version = version + 1, updated_at = now() WHERE id IN (SELECT id`+where+`)`, window.Seconds())
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
