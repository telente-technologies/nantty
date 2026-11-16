package loaders_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/loaders"
	"nantty/platform/events"
)

func TestMoneyDomainEventsAreDispatchedByTypeAndGarbageIsPoison(t *testing.T) {
	eventType := "test.dispatched." + uuid.NewString()
	received := ""
	loaders.RegisterMoneyDomainEventHandler(eventType, func(_ context.Context, envelope events.EventEnvelope) error {
		var data struct {
			AccountId string `json:"accountId"`
		}
		if err := loaders.DecodeEventData(envelope, &data); err != nil {
			return err
		}
		received = data.AccountId
		return nil
	})
	if err := loaders.DispatchMoneyDomainEvent(context.Background(), validDomainEvent(eventType, `{"accountId":"a-1"}`)); err != nil || received != "a-1" {
		t.Fatalf("dispatch: %v %q", err, received)
	}
	if err := loaders.DispatchMoneyDomainEvent(context.Background(), []byte(`not json`)); !errors.Is(err, events.ErrPoisonMessage) {
		t.Fatalf("garbage must be poison: %v", err)
	}
	if err := loaders.DispatchMoneyDomainEvent(context.Background(), []byte(`{"id":"2","type":"test.dispatched","source":"test","subject":"test","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":"oops"}`)); !errors.Is(err, events.ErrPoisonMessage) {
		t.Fatalf("bad data must be poison: %v", err)
	}
	if err := loaders.DispatchMoneyDomainEvent(context.Background(), []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000003","type":"unknown.event","source":"test","subject":"test","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{}}`)); !errors.Is(err, events.ErrPoisonMessage) {
		t.Fatalf("unregistered routed events must be rejected as poison, got %v", err)
	}
}

func TestMoneyDomainEventsRejectEnvelopesOutsideThePublishedContract(t *testing.T) {
	cases := map[string][]byte{
		"missing id":                []byte(`{"type":"test.contract","source":"test","subject":"test","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{}}`),
		"invalid id":                []byte(`{"id":"not-a-uuid","type":"test.contract","source":"test","subject":"test","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{}}`),
		"missing source":            []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"test.contract","subject":"test","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{}}`),
		"null source":               []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"test.contract","source":null,"subject":"test","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{}}`),
		"null subject":              []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"test.contract","source":"test","subject":null,"schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{}}`),
		"missing schema version":    []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"test.contract","source":"test","subject":"test","occurredAt":"2026-11-03T00:00:00Z","data":{}}`),
		"invalid schema version":    []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"test.contract","source":"test","subject":"test","schemaVersion":0,"occurredAt":"2026-11-03T00:00:00Z","data":{}}`),
		"missing timestamp":         []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"test.contract","source":"test","subject":"test","schemaVersion":1,"data":{}}`),
		"invalid timestamp":         []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"test.contract","source":"test","subject":"test","schemaVersion":1,"occurredAt":"not-a-date","data":{}}`),
		"non-object data":           []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"test.contract","source":"test","subject":"test","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":[]}`),
		"unexpected envelope field": []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"test.contract","source":"test","subject":"test","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":{},"unexpected":true}`),
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			if err := loaders.DispatchMoneyDomainEvent(context.Background(), body); !errors.Is(err, events.ErrPoisonMessage) {
				t.Fatalf("invalid envelope must be rejected as poison, got %v", err)
			}
		})
	}
}

func validDomainEvent(eventType, data string) []byte {
	return []byte(`{"id":"0192e6e0-7c00-7000-8000-000000000001","type":"` + eventType + `","source":"test","subject":"test","schemaVersion":1,"occurredAt":"2026-11-03T00:00:00Z","data":` + data + `}`)
}
