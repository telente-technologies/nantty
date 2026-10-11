package src

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/loaders"
	"zudomart/modules/payments/src/modules/gateway/services"
	platformevents "zudomart/platform/events"
)

type refundEventData struct {
	RefundId        string `json:"refundId"`
	PaymentIntentId string `json:"paymentIntentId"`
	Reference       string `json:"reference"`
}

func registerRefundOutboxHandlers(gateway *services.PaymentGateway, logger *slog.Logger) {
	loaders.RegisterMoneyDomainEventHandler("paymentRefund.requested", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var data refundEventData
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		refundId, err := uuid.Parse(data.RefundId)
		if err != nil {
			return nil
		}
		return gateway.SendPendingRefundToProvider(ctx, refundId)
	})
	loaders.RegisterMoneyDomainEventHandler("paymentRefund.failed", func(ctx context.Context, envelope platformevents.EventEnvelope) error {
		var data refundEventData
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		if logger != nil {
			logger.ErrorContext(ctx, "refund failed at the provider; its capacity was released and it needs a retry or staff follow-up",
				"refundId", data.RefundId, "paymentIntentId", data.PaymentIntentId, "reference", data.Reference, "alert", "paymentRefundFailed")
		}
		return nil
	})
}
