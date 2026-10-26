package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent/processedevent"
	platformevents "nantty/platform/events"
)

type EscrowEventData struct {
	EscrowId    string     `json:"escrowId"`
	OrderId     string     `json:"orderId"`
	Amount      moneyData  `json:"amount"`
	Refunded    moneyData  `json:"refunded"`
	Status      string     `json:"status"`
	BuyerUserId string     `json:"buyerUserId"`
	DisputeId   string     `json:"disputeId"`
	ReleaseAt   *time.Time `json:"autoReleaseAt"`
	Pending     moneyData  `json:"pendingRefund"`
}

type moneyData struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type MoneyEventHandler struct {
	Container *container.Container
}

func (handler MoneyEventHandler) Handle(ctx context.Context, body []byte) error {
	var envelope platformevents.EventEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return fmt.Errorf("%w: event envelope is not JSON", platformevents.ErrPoisonMessage)
	}
	seen, err := handler.Container.Client.ProcessedEvent.Query().Where(processedevent.EnvelopeID(envelope.Id)).Exist(ctx)
	if err != nil || seen {
		return err
	}
	var data EscrowEventData
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return nil
	}
	orderId, err := uuid.Parse(data.OrderId)
	if err != nil {
		return nil
	}
	if err := handler.apply(ctx, envelope.Type, orderId, data); err != nil {
		return fmt.Errorf("apply %s for order %s: %w", envelope.Type, orderId, err)
	}
	err = handler.Container.Client.ProcessedEvent.Create().SetEnvelopeID(envelope.Id).SetEventType(envelope.Type).OnConflictColumns(processedevent.FieldEnvelopeID).DoNothing().Exec(ctx)
	if err != nil && !isNoRowsError(err) {
		return err
	}
	return nil
}

func (handler MoneyEventHandler) apply(ctx context.Context, eventType string, orderId uuid.UUID, data EscrowEventData) error {
	switch eventType {
	case "escrow.held", "directPayment.received":
		return RecordOrderPaid(ctx, handler.Container, orderId)
	case "escrow.released":
		return CompleteOrderGroup(ctx, handler.Container, orderId, SystemActor, "Escrow released to the seller")
	case "escrow.refunded", "escrow.partiallyRefunded", "escrow.clawedBack":
		return RecordSettledOrderRefund(ctx, handler.Container, orderId, data.Refunded.AmountMinor, data.DisputeId, data.Status == "refunded" || data.Status == "clawedBack")
	case "escrow.refundScheduled":
		return RecordOrderRefundScheduled(ctx, handler.Container, orderId, data.Pending.AmountMinor)
	case "escrow.releaseFailed":
		return RecordEscrowReleaseRetry(ctx, handler.Container, orderId, data.ReleaseAt)
	case "escrow.releaseScheduled":
		return RecordEscrowReleaseTime(ctx, handler.Container, orderId, data.ReleaseAt)
	case "dispute.opened":
		return MarkOrderDisputed(ctx, handler.Container, orderId, true)
	case "dispute.closed":
		return MarkOrderDisputed(ctx, handler.Container, orderId, false)
	}
	return nil
}

func (handler MoneyEventHandler) ContainerForDisputeClose() *container.Container {
	return handler.Container
}
