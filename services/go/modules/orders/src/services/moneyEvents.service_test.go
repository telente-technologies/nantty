package services

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"

	platformevents "nantty/platform/events"
)

func TestValidateMoneyEventEnvelopeEnforcesPublishedContract(t *testing.T) {
	valid := []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"escrow.refundScheduled","source":"nantty.escrow","subject":"order-1","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{"orderId":"0192e6e0-7c00-7000-8000-000000000002","pendingRefund":{"amountMinor":1000,"currency":"NGN"}}}`)
	var envelope platformevents.EventEnvelope
	if err := json.Unmarshal(valid, &envelope); err != nil {
		t.Fatal(err)
	}
	if err := validateMoneyEventEnvelope(valid, envelope); err != nil {
		t.Fatalf("valid envelope rejected: %v", err)
	}
	data, _, err := decodeMoneyEventData(envelope.Data)
	if err != nil || validateMoneyEventData(envelope.Type, data) != nil {
		t.Fatalf("valid event data rejected: decode=%v validation=%v", err, validateMoneyEventData(envelope.Type, data))
	}

	cases := map[string][]byte{
		"missing source":      []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"escrow.refundScheduled","subject":"order-1","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{"orderId":"0192e6e0-7c00-7000-8000-000000000002"}}`),
		"invalid id":          []byte(`{"id":"bad","type":"escrow.refundScheduled","source":"nantty.escrow","subject":"order-1","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{"orderId":"0192e6e0-7c00-7000-8000-000000000002"}}`),
		"zero schema version": []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"escrow.refundScheduled","source":"nantty.escrow","subject":"order-1","schemaVersion":0,"occurredAt":"2026-11-03T00:00:00Z","data":{"orderId":"0192e6e0-7c00-7000-8000-000000000002"}}`),
		"unknown field":       []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"escrow.refundScheduled","source":"nantty.escrow","subject":"order-1","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{"orderId":"0192e6e0-7c00-7000-8000-000000000002"},"extra":true}`),
		"non-object data":     []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"escrow.refundScheduled","source":"nantty.escrow","subject":"order-1","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":[]}`),
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			var decoded platformevents.EventEnvelope
			if err := json.Unmarshal(body, &decoded); err != nil {
				t.Fatal(err)
			}
			if err := validateMoneyEventEnvelope(body, decoded); !errors.Is(err, platformevents.ErrPoisonMessage) {
				t.Fatalf("invalid envelope must be poison, got %v", err)
			}
		})
	}
}

func TestValidateMoneyEventDataRejectsMissingFieldsRequiredByOrderEffects(t *testing.T) {
	tests := []struct {
		name      string
		eventType string
		data      EscrowEventData
	}{
		{name: "release schedule without date", eventType: "escrow.releaseScheduled"},
		{name: "failed release without retry time", eventType: "escrow.releaseFailed"},
		{name: "scheduled refund without positive amount", eventType: "escrow.refundScheduled", data: EscrowEventData{Pending: moneyData{Currency: "NGN"}}},
		{name: "scheduled refund without currency", eventType: "escrow.refundScheduled", data: EscrowEventData{Pending: moneyData{AmountMinor: 1000}}},
		{name: "scheduled refund with malformed currency", eventType: "escrow.refundScheduled", data: EscrowEventData{Pending: moneyData{AmountMinor: 1000, Currency: "ngn"}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := validateMoneyEventData(test.eventType, test.data); !errors.Is(err, platformevents.ErrPoisonMessage) {
				t.Fatalf("invalid event data must be poison, got %v", err)
			}
		})
	}
}

func TestDecodeMoneyEventDataRejectsMalformedPayloadsAsPoison(t *testing.T) {
	tests := map[string]json.RawMessage{
		"non-object data":  json.RawMessage(`[]`),
		"invalid order id": json.RawMessage(`{"orderId":"not-a-uuid"}`),
	}
	for name, payload := range tests {
		t.Run(name, func(t *testing.T) {
			if _, _, err := decodeMoneyEventData(payload); !errors.Is(err, platformevents.ErrPoisonMessage) {
				t.Fatalf("malformed event data must be surfaced for poison-message handling; got %v", err)
			}
		})
	}
}

func TestMoneyEventHandlerRejectsUnboundEventAsPoison(t *testing.T) {
	handler := MoneyEventHandler{}
	err := handler.apply(context.Background(), "escrow.unexpected", uuid.New(), EscrowEventData{}, "")
	if !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("unbound event must be routed for poison-message handling, got %v", err)
	}
}
