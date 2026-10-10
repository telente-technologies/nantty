package services

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/creatorsubscription"
	"zudomart/modules/subscriptions/src/models"
)

func (service CreatorSubscriptions) FindForMember(ctx context.Context, userId, subscriptionId string) (*ent.CreatorSubscription, error) {
	id, err := uuid.Parse(subscriptionId)
	if err != nil {
		return nil, ErrCreatorSubscriptionGone
	}
	row, err := service.Container.Client(service.Container.Resources.Database).CreatorSubscription.Get(ctx, id)
	if ent.IsNotFound(err) || (err == nil && row.SubscriberID != userId && row.CreatorID != userId) {
		return nil, ErrCreatorSubscriptionGone
	}
	return row, err
}

func (service CreatorSubscriptions) ListMine(ctx context.Context, subscriberId string) ([]CreatorSubscriptionStateView, error) {
	rows, err := service.Container.Client(service.Container.Resources.Database).CreatorSubscription.Query().
		Where(creatorsubscription.SubscriberID(subscriberId), creatorsubscription.StatusNEQ(creatorsubscription.StatusFailed)).
		Order(ent.Desc(creatorsubscription.FieldCreatedAt)).Limit(200).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]CreatorSubscriptionStateView, 0, len(rows))
	for _, row := range rows {
		views = append(views, ConvertCreatorSubscription(row))
	}
	return views, nil
}

func (service CreatorSubscriptions) changeOwnSubscription(ctx context.Context, subscriberId, subscriptionId string, change func(context.Context, *sql.Tx, *ent.CreatorSubscription) (*ent.CreatorSubscription, error)) (CreatorSubscriptionStateView, error) {
	id, err := uuid.Parse(subscriptionId)
	if err != nil {
		return CreatorSubscriptionStateView{}, ErrCreatorSubscriptionGone
	}
	var changed *ent.CreatorSubscription
	err = databases.RunInMoneyTransaction(ctx, service.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		row, err := service.Container.Client(transaction).CreatorSubscription.Query().Where(creatorsubscription.ID(id)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) || (err == nil && row.SubscriberID != subscriberId) {
			return ErrCreatorSubscriptionGone
		}
		if err != nil {
			return err
		}
		changed, err = change(ctx, transaction, row)
		return err
	})
	if err != nil {
		return CreatorSubscriptionStateView{}, err
	}
	return ConvertCreatorSubscription(changed), nil
}

func (service CreatorSubscriptions) Cancel(ctx context.Context, subscriberId, subscriptionId string) (CreatorSubscriptionStateView, error) {
	return service.changeOwnSubscription(ctx, subscriberId, subscriptionId, func(ctx context.Context, transaction *sql.Tx, row *ent.CreatorSubscription) (*ent.CreatorSubscription, error) {
		if row.BillingChannel != creatorsubscription.BillingChannelWeb {
			return nil, ErrManageInStore
		}
		if row.Status == creatorsubscription.StatusCancelled {
			return row, nil
		}
		if row.Status != creatorsubscription.StatusActive && row.Status != creatorsubscription.StatusPastDue {
			return nil, ErrOnlyActiveCancellable
		}
		cancelled, err := row.Update().SetStatus(creatorsubscription.StatusCancelled).ClearNextChargeAt().Save(ctx)
		if err != nil {
			return nil, err
		}
		return cancelled, service.emit(ctx, transaction, "creatorSubscription.cancelled", row.ID.String(), lifecycleEventData(cancelled))
	})
}

func (service CreatorSubscriptions) Resume(ctx context.Context, subscriberId, subscriptionId string) (CreatorSubscriptionStateView, error) {
	return service.changeOwnSubscription(ctx, subscriberId, subscriptionId, func(ctx context.Context, transaction *sql.Tx, row *ent.CreatorSubscription) (*ent.CreatorSubscription, error) {
		if row.BillingChannel != creatorsubscription.BillingChannelWeb {
			return nil, ErrManageInStore
		}
		if row.Status == creatorsubscription.StatusActive {
			return row, nil
		}
		if row.Status != creatorsubscription.StatusCancelled || !models.HasCreatorSubscriberAccess(row.Status.String(), row.CurrentPeriodEnd, service.Container.Now().UTC()) {
			return nil, ErrSubscriptionEnded
		}
		resumed, err := row.Update().SetStatus(creatorsubscription.StatusActive).SetNillableNextChargeAt(row.CurrentPeriodEnd).Save(ctx)
		if err != nil {
			return nil, err
		}
		return resumed, service.emit(ctx, transaction, "creatorSubscription.resumed", row.ID.String(), lifecycleEventData(resumed))
	})
}

func (service CreatorSubscriptions) HasSubscriberAccess(ctx context.Context, subscriberId, creatorId string) (bool, error) {
	if subscriberId == "" || creatorId == "" {
		return false, nil
	}
	if subscriberId == creatorId {
		return true, nil
	}
	return service.Container.Client(service.Container.Resources.Database).CreatorSubscription.Query().
		Where(creatorsubscription.SubscriberID(subscriberId), creatorsubscription.CreatorID(creatorId), creatorsubscription.StatusIn(accessStatuses()...),
			creatorsubscription.CurrentPeriodEndGT(service.Container.Now().UTC())).Exist(ctx)
}

func lifecycleEventData(row *ent.CreatorSubscription) map[string]any {
	return map[string]any{
		"subscriptionId": row.ID.String(), "creatorId": row.CreatorID, "subscriberId": row.SubscriberID, "planId": row.PlanID, "status": row.Status.String(),
		"currentPeriodEnd": row.CurrentPeriodEnd,
	}
}
