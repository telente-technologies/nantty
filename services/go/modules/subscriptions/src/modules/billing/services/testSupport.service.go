package services

import (
	"context"
	"database/sql"

	"nantty/modules/ledger/src/databases"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
)

func (billing Billing) HandleBillingSubscriptionChangedForTest(ctx context.Context, reference, status string) error {
	return databases.RunInMoneyTransaction(ctx, billing.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return billing.HandleBillingSubscriptionChanged(ctx, transaction, paymentmodels.BillingSubscriptionChange{Reference: reference, Status: status, OccurredAt: billing.Container.Now()})
	})
}
