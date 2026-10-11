package services

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
)

func (billing Billing) CancelSubscription(ctx context.Context, userId string, subscriptionId uuid.UUID) (SubscriptionView, error) {
	client := billing.Container.Client(billing.Container.Resources.Database)
	row, err := client.Subscription.Query().Where(subscription.ID(subscriptionId), subscription.OwnerUserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return SubscriptionView{}, ErrSubscriptionMissing
	}
	if err != nil {
		return SubscriptionView{}, err
	}
	switch row.Status {
	case subscription.StatusAwaitingCard, subscription.StatusPending:
		err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			return billing.Container.Client(transaction).Subscription.UpdateOneID(row.ID).SetStatus(subscription.StatusCanceled).SetActivationPending(false).Exec(ctx)
		})
	case subscription.StatusTrialing, subscription.StatusActive, subscription.StatusPastDue, subscription.StatusGrace:
		err = databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			if err := billing.Container.Client(transaction).Subscription.UpdateOneID(row.ID).SetCancelAtPeriodEnd(true).SetPendingPlanCode("").SetPendingInterval("").Exec(ctx); err != nil {
				return err
			}
			if IsWebCheckoutChannel(row.Channel) && row.BillingReference != "" && row.ProviderPlanCode != "" {
				if err := billing.emit(ctx, transaction, ProviderCancelRequestedEvent, row.ID.String(), map[string]any{"subscriptionId": row.ID.String()}); err != nil {
					return err
				}
			}
			return billing.emit(ctx, transaction, "subscription.cancellationScheduled", row.ID.String(), entitlementData(row, string(row.Status)))
		})
	}
	if err != nil {
		return SubscriptionView{}, err
	}
	updated, err := client.Subscription.Get(ctx, row.ID)
	if err != nil {
		return SubscriptionView{}, err
	}
	return ConvertSubscription(updated), nil
}

const ProviderCancelRequestedEvent = "subscription.providerCancelRequested"

func (billing Billing) HandleProviderCancelRequested(ctx context.Context, subscriptionId string) error {
	id, err := uuid.Parse(subscriptionId)
	if err != nil {
		return nil
	}
	row, err := billing.Container.Client(billing.Container.Resources.Database).Subscription.Get(ctx, id)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if !row.CancelAtPeriodEnd && row.Status != subscription.StatusCanceled {
		return nil
	}
	return billing.Container.Payments.CancelBillingSubscription(ctx, row.BillingReference)
}
