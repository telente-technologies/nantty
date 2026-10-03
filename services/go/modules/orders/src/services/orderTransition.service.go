package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/enums"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
)

type OrderActor struct {
	Kind      string
	AccountId *uuid.UUID
	Name      string
}

var SystemActor = OrderActor{Kind: enums.ActorSystem}

func LockOrderGroup(ctx context.Context, tx *ent.Tx, orderId uuid.UUID) (*ent.OrderGroup, error) {
	group, err := tx.OrderGroup.Query().Where(ordergroup.ID(orderId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ordererrors.OrderNotFound
	}
	return group, err
}

func AppendTimelineEvent(ctx context.Context, tx *ent.Tx, groupId uuid.UUID, kind, summary string, actor OrderActor) error {
	create := tx.OrderEvent.Create().SetOrderGroupID(groupId).SetKind(kind).SetSummary(summary).SetActorKind(actor.Kind).SetActorName(actor.Name)
	if actor.AccountId != nil {
		create.SetActorAccountID(*actor.AccountId)
	}
	return create.Exec(ctx)
}

type Transition struct {
	To        string
	Summary   string
	Kind      string
	Actor     OrderActor
	Customize func(update *ent.OrderGroupUpdateOne)
}

func TransitionOrderGroup(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, transition Transition, now time.Time) (*ent.OrderGroup, error) {
	if !CanTransition(group.Status, transition.To) || !ActorMayMoveTo(transition.Actor.Kind, transition.To) {
		return nil, ordererrors.InvalidStatusChange
	}
	update := tx.OrderGroup.UpdateOneID(group.ID).SetStatus(transition.To).SetPreviousStatus(group.Status).AddVersion(1).
		SetDeliveryStatus(DeliveryStatusFor(transition.To, group.DeliveryStatus))
	if transition.Customize != nil {
		transition.Customize(update)
	}
	updated, err := update.Save(ctx)
	if err != nil {
		return nil, err
	}
	kind := transition.Kind
	if kind == "" {
		kind = TimelineKindFor(transition.To)
	}
	if err := AppendTimelineEvent(ctx, tx, group.ID, kind, transition.Summary, transition.Actor); err != nil {
		return nil, err
	}
	err = events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.statusChanged", group.ID.String(), now, map[string]any{
		"orderGroupId": group.ID, "checkoutId": group.CheckoutID, "storeId": group.StoreID, "buyerAccountId": group.BuyerAccountID,
		"sellerAccountId": group.SellerAccountID, "from": group.Status, "to": transition.To, "reference": group.Reference, "actorKind": transition.Actor.Kind,
	})
	return updated, err
}
