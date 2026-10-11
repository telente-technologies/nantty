package services

import (
	"context"
	"database/sql"
	"time"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/dispute"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/generated/ent/predicate"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
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
		switch {
		case isDirectSale(held):
			err = service.recordLostChargebackOnDirectSale(ctx, transaction, held, notice)
		case IsWalletLocked(held):
			err = service.recoverLostChargebackFromWallets(ctx, transaction, held, notice)
		default:
			return ErrLegacyEscrowCustody
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

func isActiveBuyerDispute() predicate.Dispute {
	return dispute.StatusIn(dispute.StatusAwaitingSeller, dispute.StatusUnderReview)
}
