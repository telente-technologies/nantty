package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
)

type CancelRequest struct {
	OrderId       uuid.UUID
	Actor         OrderActor
	Reason        string
	OnlyWhenNew   bool
	SellerStoreId *uuid.UUID
	BuyerId       *uuid.UUID
}

func CancelOrderGroup(ctx context.Context, deployed *container.Container, request CancelRequest) (*ent.OrderGroup, error) {
	released := false
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err := LockOrderGroup(ctx, tx, request.OrderId)
		if err != nil {
			return err
		}
		if (request.SellerStoreId != nil && group.StoreID != *request.SellerStoreId) || (request.BuyerId != nil && group.BuyerAccountID != *request.BuyerId) {
			return ordererrors.OrderNotFound
		}
		if request.OnlyWhenNew && group.Status != enums.StatusNew {
			return ordererrors.OrderNotNew
		}
		if !CanTransition(group.Status, enums.StatusCancelled) || !ActorMayMoveTo(request.Actor.Kind, enums.StatusCancelled) ||
			(request.Actor.Kind == enums.ActorBuyer && group.Status != enums.StatusPending && group.Status != enums.StatusNew) {
			return ordererrors.OrderNotCancellable
		}
		now := deployed.Now()
		released = group.StockReserved
		if group.Status == enums.StatusPending {
			return cancelPendingGroup(ctx, tx, group, request.Reason, now)
		}
		_, err = TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusCancelled, Summary: request.Reason, Actor: request.Actor, Customize: func(update *ent.OrderGroupUpdateOne) {
			update.SetCancelReason(request.Reason).SetRefundRequestedAt(now)
		}}, now)
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.refundRequested", group.ID.String(), now, map[string]any{
			"orderGroupId": group.ID, "storeId": group.StoreID, "buyerAccountId": group.BuyerAccountID, "amountMinor": group.TotalMinor, "currency": group.Currency, "reason": request.Reason,
		})
	})
	if err != nil {
		return nil, err
	}
	if released {
		if stock, stockError := deployed.Stock(); stockError == nil {
			if err := stock.Release(context.WithoutCancel(ctx), request.OrderId.String()); err != nil {
				return nil, err
			}
		}
	}
	return deployed.Client.OrderGroup.Get(ctx, request.OrderId)
}
