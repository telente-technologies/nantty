package services

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/dispute"
	"nantty/modules/ledger/src/databases"
)

func (service DisputeService) EscalateDisputesPastSellerDeadline(ctx context.Context, limit int) int {
	container := service.Escrows.Container
	overdue, err := container.Client(container.Resources.Database).Dispute.Query().
		Where(dispute.StatusEQ(dispute.StatusAwaitingSeller), dispute.RespondByAtLTE(container.Now().UTC())).
		Order(ent.Asc(dispute.FieldRespondByAt)).Limit(limit).All(ctx)
	if err != nil {
		container.Resources.Logger.WarnContext(ctx, "could not list disputes past the seller deadline", "error", err)
		return 0
	}
	escalated := 0
	for _, candidate := range overdue {
		var moved bool
		err := databases.RunInMoneyTransaction(ctx, container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			var err error
			moved, err = service.escalateOverdueDisputeInTransaction(ctx, transaction, candidate)
			return err
		})
		if err != nil {
			container.Resources.Logger.WarnContext(ctx, "dispute escalation failed; it is retried", "disputeId", candidate.ID.String(), "error", err)
			continue
		}
		if moved {
			escalated++
		}
	}
	return escalated
}

func (service DisputeService) escalateOverdueDisputeInTransaction(ctx context.Context, transaction *sql.Tx, candidate *ent.Dispute) (bool, error) {
	container := service.Escrows.Container
	client := container.Client(transaction)
	locked, held, err := service.lockDisputeWithEscrow(ctx, client, candidate.ID)
	if err != nil {
		return false, err
	}
	now := container.Now().UTC()
	if locked.Status != dispute.StatusAwaitingSeller || locked.RespondByAt == nil || locked.RespondByAt.After(now) {
		return false, nil
	}
	escalated, err := locked.Update().Where(dispute.Version(locked.Version)).AddVersion(1).SetStatus(dispute.StatusUnderReview).Save(ctx)
	if err != nil {
		return false, err
	}
	if err := service.recordStatus(ctx, client, locked.ID, string(dispute.StatusUnderReview), "Seller did not respond within 48 hours — Nantty support is reviewing"); err != nil {
		return false, err
	}
	if err := service.recordEscrowEvent(ctx, client, held.ID, "dispute_seller_deadline_missed", "system", "", map[string]any{"disputeId": locked.ID.String()}); err != nil {
		return false, err
	}
	data := disputeEventData(escalated, held)
	data["respondByAt"], data["escalatedAt"] = locked.RespondByAt.UTC(), now
	return true, container.Outbox.EnqueueInTransaction(ctx, transaction, "dispute.sellerResponseOverdue", locked.ID.String(), now, data)
}
