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
	Amount      MoneyData  `json:"amount"`
	Refunded    MoneyData  `json:"refunded"`
	Status      string     `json:"status"`
	BuyerUserId string     `json:"buyerUserId"`
	DisputeId   string     `json:"disputeId"`
	ReleaseAt   *time.Time `json:"autoReleaseAt"`
	Pending     MoneyData  `json:"pendingRefund"`
}

type MoneyData struct {
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
	if err := ValidateMoneyEventEnvelope(body, envelope); err != nil {
		return err
	}
	data, orderId, err := DecodeMoneyEventData(envelope.Data)
	if err != nil {
		return err
	}
	if err := ValidateMoneyEventData(envelope.Type, data); err != nil {
		return err
	}
	seen, err := handler.Container.Client.ProcessedEvent.Query().Where(processedevent.EnvelopeID(envelope.Id)).Exist(ctx)
	if err != nil || seen {
		return err
	}
	if err := handler.apply(ctx, envelope.Type, orderId, data, envelope.Id); err != nil {
		return fmt.Errorf("apply %s for order %s: %w", envelope.Type, orderId, err)
	}
	err = handler.Container.Client.ProcessedEvent.Create().SetEnvelopeID(envelope.Id).SetEventType(envelope.Type).OnConflictColumns(processedevent.FieldEnvelopeID).DoNothing().Exec(ctx)
	if err != nil && !isNoRowsError(err) {
		return err
	}
	return nil
}

func ValidateMoneyEventEnvelope(body []byte, envelope platformevents.EventEnvelope) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil || fields == nil {
		return fmt.Errorf("%w: event envelope must be a JSON object", platformevents.ErrPoisonMessage)
	}
	allowed := map[string]struct{}{"id": {}, "type": {}, "source": {}, "subject": {}, "schemaVersion": {}, "occurredAt": {}, "data": {}}
	for name := range fields {
		if _, ok := allowed[name]; !ok {
			return fmt.Errorf("%w: unexpected envelope field %q", platformevents.ErrPoisonMessage, name)
		}
	}
	for _, name := range []string{"id", "type", "source", "subject", "schemaVersion", "occurredAt", "data"} {
		if _, ok := fields[name]; !ok {
			return fmt.Errorf("%w: missing envelope field %q", platformevents.ErrPoisonMessage, name)
		}
	}
	for _, name := range []string{"type", "source", "subject"} {
		var value *string
		if err := json.Unmarshal(fields[name], &value); err != nil || value == nil || *value == "" {
			return fmt.Errorf("%w: envelope field %q must be a non-empty string", platformevents.ErrPoisonMessage, name)
		}
	}
	if _, err := uuid.Parse(envelope.Id); err != nil {
		return fmt.Errorf("%w: envelope id must be a UUID", platformevents.ErrPoisonMessage)
	}
	if envelope.SchemaVersion < 1 || envelope.OccurredAt.IsZero() {
		return fmt.Errorf("%w: positive schemaVersion and occurredAt are required", platformevents.ErrPoisonMessage)
	}
	var data map[string]json.RawMessage
	if err := json.Unmarshal(envelope.Data, &data); err != nil || data == nil {
		return fmt.Errorf("%w: envelope data must be a JSON object", platformevents.ErrPoisonMessage)
	}
	return nil
}

func DecodeMoneyEventData(payload json.RawMessage) (EscrowEventData, uuid.UUID, error) {
	var data EscrowEventData
	if err := json.Unmarshal(payload, &data); err != nil {
		return EscrowEventData{}, uuid.Nil, fmt.Errorf("%w: event data is invalid", platformevents.ErrPoisonMessage)
	}
	orderId, err := uuid.Parse(data.OrderId)
	if err != nil {
		return EscrowEventData{}, uuid.Nil, fmt.Errorf("%w: event data orderId is invalid", platformevents.ErrPoisonMessage)
	}
	return data, orderId, nil
}

func ValidateMoneyEventData(eventType string, data EscrowEventData) error {
	switch eventType {
	case "escrow.held", "directPayment.received", "escrow.released", "dispute.opened", "dispute.closed", "dispute.resolved":
	case "escrow.refunded", "escrow.partiallyRefunded", "escrow.clawedBack":
		if data.Refunded.AmountMinor <= 0 || !isCurrencyCode(data.Refunded.Currency) {
			return fmt.Errorf("%w: %s data requires a positive refunded amount and currency", platformevents.ErrPoisonMessage, eventType)
		}
	case "escrow.refundScheduled":
		if data.Pending.AmountMinor <= 0 || !isCurrencyCode(data.Pending.Currency) {
			return fmt.Errorf("%w: escrow.refundScheduled data requires a positive pending refund amount and currency", platformevents.ErrPoisonMessage)
		}
	case "escrow.releaseScheduled", "escrow.releaseFailed":
		if data.ReleaseAt == nil {
			return fmt.Errorf("%w: %s data requires autoReleaseAt", platformevents.ErrPoisonMessage, eventType)
		}
	default:
		return fmt.Errorf("%w: unsupported orders money event %q", platformevents.ErrPoisonMessage, eventType)
	}
	return nil
}

func isCurrencyCode(currency string) bool {
	if len(currency) != 3 {
		return false
	}
	for _, character := range currency {
		if character < 'A' || character > 'Z' {
			return false
		}
	}
	return true
}

func (handler MoneyEventHandler) apply(ctx context.Context, eventType string, orderId uuid.UUID, data EscrowEventData, envelopeID string) error {
	switch eventType {
	case "escrow.held", "directPayment.received":
		return RecordOrderPaidForEvent(ctx, handler.Container, orderId, eventType, envelopeID)
	case "escrow.released":
		return CompleteOrderGroupForEvent(ctx, handler.Container, orderId, SystemActor, "Escrow released to the seller", envelopeID)
	case "escrow.refunded", "escrow.partiallyRefunded", "escrow.clawedBack":
		return RecordSettledOrderRefundForEvent(ctx, handler.Container, orderId, data.Refunded.AmountMinor, data.Refunded.Currency, data.DisputeId,
			data.Status == "refunded" || data.Status == "clawedBack", eventType, envelopeID)
	case "escrow.refundScheduled":
		return RecordOrderRefundScheduledForEvent(ctx, handler.Container, orderId, data.Pending.AmountMinor, envelopeID)
	case "escrow.releaseFailed":
		return RecordEscrowReleaseRetryForEvent(ctx, handler.Container, orderId, data.ReleaseAt, envelopeID)
	case "escrow.releaseScheduled":
		return RecordEscrowReleaseTimeForEvent(ctx, handler.Container, orderId, data.ReleaseAt, envelopeID)
	case "dispute.opened":
		return MarkOrderDisputedForEvent(ctx, handler.Container, orderId, true, envelopeID)
	case "dispute.closed":
		return MarkOrderDisputedForEvent(ctx, handler.Container, orderId, false, envelopeID)
	case "dispute.resolved":
		return MarkOrderDisputeResolvedForEvent(ctx, handler.Container, orderId, envelopeID)
	default:
		return fmt.Errorf("%w: unsupported orders money event %q", platformevents.ErrPoisonMessage, eventType)
	}
}

func (handler MoneyEventHandler) ContainerForDisputeClose() *container.Container {
	return handler.Container
}
