package loaders

import (
	"context"
	"errors"
	"testing"

	"zudomart/platform/events"
)

func TestMoneyDomainEventsAreDispatchedByTypeAndGarbageIsPoison(t *testing.T) {
	received := ""
	RegisterMoneyDomainEventHandler("test.dispatched", func(_ context.Context, envelope events.EventEnvelope) error {
		var data struct {
			AccountId string `json:"accountId"`
		}
		if err := DecodeEventData(envelope, &data); err != nil {
			return err
		}
		received = data.AccountId
		return nil
	})
	if err := DispatchMoneyDomainEvent(context.Background(), []byte(`{"id":"1","type":"test.dispatched","data":{"accountId":"a-1"}}`)); err != nil || received != "a-1" {
		t.Fatalf("dispatch: %v %q", err, received)
	}
	if err := DispatchMoneyDomainEvent(context.Background(), []byte(`not json`)); !errors.Is(err, events.ErrPoisonMessage) {
		t.Fatalf("garbage must be poison: %v", err)
	}
	if err := DispatchMoneyDomainEvent(context.Background(), []byte(`{"id":"2","type":"test.dispatched","data":"oops"}`)); !errors.Is(err, events.ErrPoisonMessage) {
		t.Fatalf("bad data must be poison: %v", err)
	}
	if err := DispatchMoneyDomainEvent(context.Background(), []byte(`{"id":"3","type":"unknown.event","data":{}}`)); err != nil {
		t.Fatalf("unknown events are acknowledged: %v", err)
	}
}
