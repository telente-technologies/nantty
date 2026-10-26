package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/platform/commerceports"
)

type SellerContext struct {
	Store   commerceports.StoreAccess
	ActorId uuid.UUID
	Name    string
}

func (seller SellerContext) actor() OrderActor {
	identifier := seller.ActorId
	return OrderActor{Kind: enums.ActorSeller, AccountId: &identifier, Name: seller.Name}
}

func LoadStoreOrder(ctx context.Context, deployed *container.Container, storeId, orderId uuid.UUID) (*ent.OrderGroup, error) {
	group, err := deployed.Client.OrderGroup.Query().Where(ordergroup.ID(orderId), ordergroup.StoreID(storeId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ordererrors.OrderNotFound
	}
	return group, err
}

func AcceptOrder(ctx context.Context, deployed *container.Container, seller SellerContext, orderId uuid.UUID) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err := lockStoreOrder(ctx, tx, seller.Store.StoreId, orderId)
		if err != nil {
			return err
		}
		if group.Status != enums.StatusNew {
			return ordererrors.OrderNotNew
		}
		_, err = TransitionOrderGroup(ctx, tx, group, Transition{To: enums.StatusProcessing, Kind: "accepted", Summary: "The seller accepted the order", Actor: seller.actor()}, deployed.Now())
		return err
	})
}

func lockStoreOrder(ctx context.Context, tx *ent.Tx, storeId, orderId uuid.UUID) (*ent.OrderGroup, error) {
	group, err := LockOrderGroup(ctx, tx, orderId)
	if err != nil {
		return nil, err
	}
	if group.StoreID != storeId {
		return nil, ordererrors.OrderNotFound
	}
	return group, nil
}

var sellerStatusMoves = map[string]string{enums.StatusProcessing: enums.StatusNew, enums.StatusReady: enums.StatusProcessing, enums.StatusDelivered: enums.StatusShipped}

func UpdateOrderStatus(ctx context.Context, deployed *container.Container, seller SellerContext, orderId uuid.UUID, target string) error {
	group, err := LoadStoreOrder(ctx, deployed, seller.Store.StoreId, orderId)
	if err != nil {
		return err
	}
	validFrom := group.Status == sellerStatusMoves[target] || (target == enums.StatusProcessing && group.Status == enums.StatusReady)
	if !validFrom || !CanTransition(group.Status, target) {
		return ordererrors.InvalidStatusChange
	}
	now := deployed.Now()
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := lockStoreOrder(ctx, tx, seller.Store.StoreId, orderId)
		if err != nil || locked.Status != group.Status {
			return firstFailure(err, ordererrors.InvalidStatusChange)
		}
		_, err = TransitionOrderGroup(ctx, tx, locked, Transition{To: target, Summary: "Status changed to " + target, Actor: seller.actor(), Customize: func(update *ent.OrderGroupUpdateOne) {
			if target == enums.StatusDelivered {
				update.SetDeliveredAt(now).AddDeliveryAttempts(1)
			}
		}}, now)
		return err
	})
}

type ShipRequest struct {
	Courier        string
	TrackingNumber string
	TrackingUrl    *string
	FromLocationId uuid.UUID
}

func ShipOrder(ctx context.Context, deployed *container.Container, seller SellerContext, orderId uuid.UUID, request ShipRequest) error {
	group, err := LoadStoreOrder(ctx, deployed, seller.Store.StoreId, orderId)
	if err != nil {
		return err
	}
	if group.Status != enums.StatusNew && group.Status != enums.StatusProcessing && group.Status != enums.StatusReady {
		return ordererrors.OrderNotShippable
	}
	stock, err := deployed.Stock()
	if err != nil {
		return err
	}
	if owned, err := stock.StoreOwnsLocations(ctx, seller.Store.StoreId, []uuid.UUID{request.FromLocationId}); err != nil || !owned {
		return firstFailure(err, ordererrors.InvalidLocation)
	}
	if group.StockReserved {
		if err := stock.Fulfil(ctx, commerceports.FulfilStockRequest{Reference: group.ID.String(), StoreId: group.StoreID, FromLocationId: &request.FromLocationId, ActorName: seller.Name}); err != nil {
			return err
		}
	}
	now := deployed.Now()
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := lockStoreOrder(ctx, tx, seller.Store.StoreId, orderId)
		if err != nil || locked.Status == enums.StatusShipped {
			return err
		}
		_, err = TransitionOrderGroup(ctx, tx, locked, Transition{To: enums.StatusShipped, Summary: "Shipped with " + request.Courier + ", tracking " + request.TrackingNumber, Actor: seller.actor(), Customize: func(update *ent.OrderGroupUpdateOne) {
			update.SetCourierName(request.Courier).SetTrackingNumber(request.TrackingNumber).SetNillableTrackingURL(request.TrackingUrl).SetFromLocationID(request.FromLocationId).SetShippedAt(now)
		}}, now)
		return err
	})
}

func derefOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func AddOrderNote(ctx context.Context, deployed *container.Container, seller SellerContext, orderId uuid.UUID, body string) error {
	group, err := LoadStoreOrder(ctx, deployed, seller.Store.StoreId, orderId)
	if err != nil {
		return err
	}
	return deployed.Client.OrderNote.Create().SetOrderGroupID(group.ID).SetAuthorAccountID(seller.ActorId).SetAuthorName(seller.Name).SetBody(body).Exec(ctx)
}

func CancelSellerOrder(ctx context.Context, deployed *container.Container, seller SellerContext, orderId uuid.UUID, reason string, onlyWhenNew bool) error {
	storeId := seller.Store.StoreId
	_, err := CancelOrderGroup(ctx, deployed, CancelRequest{OrderId: orderId, Actor: seller.actor(), Reason: reason, OnlyWhenNew: onlyWhenNew, SellerStoreId: &storeId})
	return err
}
