package services

import (
	"context"
	"database/sql"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/billingsubscription"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
)

func SubscriptionStatusForNotification(eventType, providerStatus string) string {
	switch eventType {
	case "invoice.payment_failed":
		return "past_due"
	case "invoice.update", "invoice.create":
		if providerStatus == "" || providerStatus == "active" {
			return "active"
		}
	case "subscription.disable":
		return "canceled"
	case "subscription.not_renew":
		return "non_renewing"
	}
	if mapped, known := providerSubscriptionStatuses[providerStatus]; known {
		return mapped
	}
	return providerStatus
}

func (gateway *PaymentGateway) HandleSubscriptionNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	update := notification.Subscription
	if update == nil {
		return nil
	}
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		row, err := findBillingSubscription(ctx, client, update)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		status := SubscriptionStatusForNotification(notification.EventType, update.Status)
		if row.Status == "trialing" && status == "active" && notification.EventType == "subscription.create" {
			status = "trialing"
		}
		now := gateway.Container.Now().UTC()
		change := row.Update().SetStatus(truncate(status, 40))
		if update.ProviderSubscriptionId != "" && row.ProviderSubscriptionID == "" {
			change.SetProviderSubscriptionID(update.ProviderSubscriptionId)
		}
		if update.EmailToken != "" {
			change.SetEmailToken(update.EmailToken)
		}
		if update.CurrentPeriodEndsAt != nil {
			change.SetCurrentPeriodEndsAt(*update.CurrentPeriodEndsAt)
		}
		eventType := "billingSubscription." + status
		if downgradingStatuses[status] && row.DowngradedAt == nil {
			change.SetDowngradedAt(now)
			eventType = "billingSubscription.downgraded"
		}
		if err := change.Exec(ctx); err != nil {
			return err
		}
		if err := gateway.notifyBillingObservers(ctx, transaction, models.BillingSubscriptionChange{
			BillingSubscriptionId: row.ID.String(), Reference: row.Reference, ProviderSubscriptionId: firstNonEmpty(update.ProviderSubscriptionId, row.ProviderSubscriptionID),
			ProviderObjectId: notification.ProviderObjectId, PlanCode: row.PlanCode, OwnerUserId: row.OwnerUserID, EventType: notification.EventType, Status: status,
			TrialEndsAt: row.TrialEndsAt, CurrentPeriodEndsAt: update.CurrentPeriodEndsAt, OccurredAt: now, Metadata: update.Metadata,
		}); err != nil {
			return err
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, row.ID.String(), now, map[string]any{
			"billingSubscriptionId": row.ID.String(), "ownerUserId": row.OwnerUserID, "planCode": row.PlanCode, "status": status, "currentPeriodEndsAt": update.CurrentPeriodEndsAt,
		})
	})
}

func findBillingSubscription(ctx context.Context, client *ent.Client, update *interfaces.ProviderSubscriptionUpdate) (*ent.BillingSubscription, error) {
	if update.ProviderSubscriptionId != "" {
		row, err := client.BillingSubscription.Query().Where(billingsubscription.ProviderSubscriptionID(update.ProviderSubscriptionId)).ForUpdate().Only(ctx)
		if !ent.IsNotFound(err) {
			return row, err
		}
	}
	if update.ProviderCustomerId == "" || update.PlanCode == "" {
		return nil, &ent.NotFoundError{}
	}
	return client.BillingSubscription.Query().Where(billingsubscription.ProviderCustomerID(update.ProviderCustomerId), billingsubscription.ProviderProductID(update.PlanCode),
		billingsubscription.ProviderSubscriptionID("")).Order(ent.Desc(billingsubscription.FieldCreatedAt)).ForUpdate().First(ctx)
}
