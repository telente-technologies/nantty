package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/storerewardsettings"
)

func CompleteOrderGroup(ctx context.Context, deployed *container.Container, orderId uuid.UUID, actor OrderActor, summary string) error {
	return completeOrderGroup(ctx, deployed, orderId, actor, summary, "")
}

func CompleteOrderGroupForEvent(ctx context.Context, deployed *container.Container, orderId uuid.UUID, actor OrderActor, summary, envelopeID string) error {
	return completeOrderGroup(ctx, deployed, orderId, actor, summary, envelopeID)
}

func completeOrderGroup(ctx context.Context, deployed *container.Container, orderId uuid.UUID, actor OrderActor, summary, envelopeID string) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		claimed, err := claimProcessedMoneyEvent(ctx, tx, envelopeID, "escrow.released")
		if err != nil || !claimed {
			return err
		}
		group, err := LockOrderGroup(ctx, tx, orderId)
		if err != nil || group.Status == enums.StatusCompleted {
			return err
		}
		return completeLockedOrderGroup(ctx, tx, group, actor, summary, deployed.Now())
	})
}

func completeLockedOrderGroup(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, actor OrderActor, summary string, now time.Time) error {
	var err error
	if group.Status == enums.StatusShipped {
		if group, err = TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusDelivered, Summary: "Delivered", Actor: SystemActor, Customize: func(update *ent.OrderGroupUpdateOne) {
			update.SetDeliveredAt(now)
		}}, now); err != nil {
			return err
		}
	}
	completed, err := TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusCompleted, Summary: summary, Actor: actor, Customize: func(update *ent.OrderGroupUpdateOne) {
		update.SetCompletedAt(now)
	}}, now)
	if err != nil {
		return err
	}
	if err := enqueueOrderCompleted(ctx, tx, completed, now); err != nil {
		return err
	}
	return earnStoreCredit(ctx, tx, completed, now)
}

func earnStoreCredit(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, now time.Time) error {
	settings, err := tx.StoreRewardSettings.Query().Where(storerewardsettings.StoreID(group.StoreID)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	earned := CalculateEarnedCreditMinor(RewardRules{
		Enabled: settings.Enabled, BasisPoints: settings.PercentBackBasisPoints, MinimumOrderMinor: settings.MinimumOrderMinor, MaximumMinor: settings.MaxPerOrderMinor,
	}, group.SubtotalMinor-group.DiscountMinor-group.StoreCreditMinor)
	expires := now.AddDate(0, 0, settings.ExpiryDays)
	return recordCredit(ctx, tx, creditMovement{StoreId: group.StoreID, BuyerId: group.BuyerAccountID, GroupId: &group.ID, Kind: enums.CreditEarn, AmountMinor: earned,
		Currency: group.Currency, ExpiresAt: &expires, DedupeKey: "earn:" + group.ID.String(), EventType: "storeCredit.earned"}, now)
}
