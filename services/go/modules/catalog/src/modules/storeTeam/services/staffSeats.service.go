package services

import (
	"context"

	"github.com/google/uuid"

	"time"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/store"
	"zudomart/modules/catalog/src/generated/ent/storemember"
	"zudomart/platform/sellerplans"
)

func LockStoreForTeamChange(ctx context.Context, tx *ent.Tx, storeId uuid.UUID) (*ent.Store, error) {
	return tx.Store.Query().Where(store.ID(storeId)).ForUpdate().Only(ctx)
}

func RequireFreeSeat(ctx context.Context, tx *ent.Tx, storeId uuid.UUID, plan sellerplans.Plan, excluding *uuid.UUID) error {
	filter := tx.StoreMember.Query().Where(storemember.StoreID(storeId), storemember.RoleNEQ("owner"), storemember.StatusIn("active", "invited"))
	if excluding != nil {
		filter = filter.Where(storemember.IDNEQ(*excluding))
	}
	occupied, err := filter.Count(ctx)
	if err != nil {
		return err
	}
	if occupied >= sellerplans.LimitsFor(plan).MaxStaffSeats {
		return catalogerrors.SeatLimitReached
	}
	return nil
}

func EnqueueTeamEvent(ctx context.Context, tx *ent.Tx, eventType string, member *ent.StoreMember, storeName string, actorId uuid.UUID, occurredAt time.Time) error {
	return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, member.StoreID.String(), occurredAt, map[string]any{
		"storeId": member.StoreID, "storeName": storeName, "memberId": member.ID, "accountId": member.AccountID, "role": member.Role, "status": member.Status, "actorAccountId": actorId,
	})
}
