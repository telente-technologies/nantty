package recordorderfulfilment

import (
	"context"
	"errors"
	"fmt"
	"time"

	"zudomart/modules/escrow/src/modules/escrows/services"
	"zudomart/modules/ledger/src/loaders"
	platformevents "zudomart/platform/events"
)

type orderFulfilmentEventData struct {
	OrderGroupId   string     `json:"orderGroupId"`
	OccurredAt     *time.Time `json:"occurredAt"`
	CourierName    string     `json:"courierName"`
	TrackingNumber string     `json:"trackingNumber"`
	TrackingUrl    string     `json:"trackingUrl"`
}

var fulfilmentStageByEvent = map[string]string{"orderGroup.shipped": "shipped", "orderGroup.delivered": "delivered"}

func (handler Handler) HandleCommittedOrderEvent(ctx context.Context, envelope platformevents.EventEnvelope) error {
	stage, known := fulfilmentStageByEvent[envelope.Type]
	if !known {
		return nil
	}
	var data orderFulfilmentEventData
	if err := loaders.DecodeEventData(envelope, &data); err != nil || data.OrderGroupId == "" {
		return fmt.Errorf("%w: %s without an order group", platformevents.ErrPoisonMessage, envelope.Type)
	}
	occurredAt := envelope.OccurredAt
	if data.OccurredAt != nil {
		occurredAt = *data.OccurredAt
	}
	_, err := handler.Execute(ctx, Command{Fulfilment: services.OrderFulfilment{
		OrderId: data.OrderGroupId, Stage: stage, OccurredAt: occurredAt,
		CourierName: data.CourierName, TrackingNumber: data.TrackingNumber, TrackingUrl: data.TrackingUrl,
	}})
	if errors.Is(err, services.ErrEscrowNotFound) {
		return nil
	}
	return err
}
