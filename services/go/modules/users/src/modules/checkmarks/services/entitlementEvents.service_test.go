package services

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	platformevents "nantty/platform/events"
)

func TestEntitlementMessagesAreDispatchedAndOthersIgnored(t *testing.T) {
	var applied []string
	handler := HandleEntitlementEventMessage(func(_ context.Context, eventType string, data json.RawMessage) error {
		applied = append(applied, eventType+":"+string(data))
		return nil
	})
	if err := handler(context.Background(), []byte(`{"id":"1","type":"entitlement.granted","data":{"plan":"blue"}}`)); err != nil {
		t.Fatal(err)
	}
	if err := handler(context.Background(), []byte(`{"id":"2","type":"order.placed","data":{}}`)); err != nil {
		t.Fatal(err)
	}
	if err := handler(context.Background(), []byte(`{"id":"3","type":"account.registered","data":{"accountId":"a"}}`)); err != nil {
		t.Fatal(err)
	}
	if err := handler(context.Background(), []byte(`{"id":"4","type":"sellerApplication.reviewed","data":{"decision":"approved"}}`)); err != nil {
		t.Fatal(err)
	}
	if len(applied) != 3 || applied[0] != `entitlement.granted:{"plan":"blue"}` || applied[1] != `account.registered:{"accountId":"a"}` || applied[2] != `sellerApplication.reviewed:{"decision":"approved"}` {
		t.Fatalf("applied %v", applied)
	}
	if err := handler(context.Background(), []byte(`not json`)); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("expected poison, got %v", err)
	}
}
