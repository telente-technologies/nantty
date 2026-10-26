package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/predicate"
	"nantty/modules/orders/src/generated/ent/returnrequest"
)

const DirectOrderAutoCompletionSummary = "Completed automatically after the inspection window"

var openReturnStatuses = []string{"requested", "approved"}

// CompleteDirectOrdersPastTheirCompletionTime completes delivered direct-payment orders once the escrow inspection window
// (scheduled by the money service on delivery) has passed. Orders with an open dispute, refund or return request are skipped
// and checked again on the next run.
func CompleteDirectOrdersPastTheirCompletionTime(ctx context.Context, deployed *container.Container, batch int) (int, error) {
	due, err := deployed.Client.OrderGroup.Query().Where(directOrderDueForCompletion(deployed.Now())...).Order(ent.Asc(ordergroup.FieldEscrowReleaseAt)).Limit(batch).IDs(ctx)
	if err != nil {
		return 0, err
	}
	completed := 0
	for _, orderId := range due {
		done, err := completeDirectOrderIfStillDue(ctx, deployed, orderId)
		if err != nil {
			return completed, err
		}
		if done {
			completed++
		}
	}
	return completed, nil
}

func directOrderDueForCompletion(now time.Time) []predicate.OrderGroup {
	return []predicate.OrderGroup{ordergroup.PaymentMode(enums.PaymentModeDirect), ordergroup.Status(enums.StatusDelivered), ordergroup.EscrowReleaseAtNotNil(),
		ordergroup.EscrowReleaseAtLTE(now), ordergroup.RefundRequestedAtIsNil()}
}

func completeDirectOrderIfStillDue(ctx context.Context, deployed *container.Container, orderId uuid.UUID) (bool, error) {
	completed := false
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := deployed.Now()
		group, err := tx.OrderGroup.Query().Where(append(directOrderDueForCompletion(now), ordergroup.ID(orderId))...).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		openReturn, err := tx.ReturnRequest.Query().Where(returnrequest.OrderGroupID(orderId), returnrequest.StatusIn(openReturnStatuses...)).Exist(ctx)
		if err != nil || openReturn {
			return err
		}
		completed = true
		return completeLockedOrderGroup(ctx, tx, group, SystemActor, DirectOrderAutoCompletionSummary, now)
	})
	return completed, err
}
