package services

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"nantty/modules/payments/src/generated/ent"
)

func (gateway *PaymentGateway) ProviderRefundedMinorForPaymentInTransaction(ctx context.Context, transaction *sql.Tx, paymentIntentId uuid.UUID) (int64, error) {
	intent, err := gateway.Container.Client(transaction).PaymentIntent.Get(ctx, paymentIntentId)
	if ent.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return intent.RefundedMinor + intent.RefundInFlightMinor, nil
}
