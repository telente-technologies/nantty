package escrow

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/generated/ent/escrowevent"
	recordorderfulfilment "zudomart/modules/escrow/src/modules/escrows/commands/recordOrderFulfilment"
	platformevents "zudomart/platform/events"
)

func (harness *escrowHarness) deliverOrderEvent(eventType, orderId string, occurredAt time.Time) {
	harness.T.Helper()
	data, _ := json.Marshal(map[string]any{"orderGroupId": orderId, "occurredAt": occurredAt, "courierName": "GIG", "trackingNumber": "T-1"})
	envelope := platformevents.EventEnvelope{Id: uuid.NewString(), Type: eventType, OccurredAt: occurredAt, Data: data}
	if err := (recordorderfulfilment.Handler{Application: harness.escrow.Application}).HandleCommittedOrderEvent(context.Background(), envelope); err != nil {
		harness.T.Fatalf("%s: %v", eventType, err)
	}
}

func (harness *escrowHarness) escrowOf(orderId string) (*time.Time, int, string) {
	harness.T.Helper()
	client := harness.escrow.Application.Container.Client(harness.Database)
	held := client.Escrow.Query().Where(escrow.OrderID(orderId)).OnlyX(context.Background())
	delivered := client.EscrowEvent.Query().Where(escrowevent.EscrowID(held.ID), escrowevent.EventType("delivered")).CountX(context.Background())
	return held.AutoReleaseAt, delivered, string(held.Status)
}

func TestDeliveredEventSetsTheReleaseTimerOnceEvenAcrossReplaysAndDisputes(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
	harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	deliveredAt := harness.clock.UTC().Truncate(time.Second)
	harness.deliverOrderEvent("orderGroup.delivered", orderId, deliveredAt)
	first, events, _ := harness.escrowOf(orderId)
	if first == nil || !first.Equal(deliveredAt.Add(72*time.Hour)) || events != 1 {
		t.Fatalf("first delivery: %v %d", first, events)
	}
	harness.clock = harness.clock.Add(10 * time.Hour)
	harness.deliverOrderEvent("orderGroup.delivered", orderId, harness.clock)
	harness.deliverOrderEvent("orderGroup.shipped", orderId, harness.clock)
	if again, events, _ := harness.escrowOf(orderId); !again.Equal(*first) || events != 1 {
		t.Fatalf("a replayed delivery moved the timer: %v -> %v (%d events)", first, again, events)
	}
	buyerToken := harness.Tokens.UserAccessToken(buyer)
	opened := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", buyerToken, "timer-dispute-1", map[string]any{"reason": "damaged", "description": "Torn", "evidenceUrls": []string{}})
	if opened.Status != http.StatusCreated {
		t.Fatalf("open dispute: %d %s", opened.Status, opened.Raw)
	}
	harness.deliverOrderEvent("orderGroup.delivered", orderId, harness.clock)
	if paused, _, status := harness.escrowOf(orderId); paused != nil || status != "disputed" {
		t.Fatalf("a delivery during a dispute must not restart the timer: %v %s", paused, status)
	}
	if closed := harness.Call(http.MethodPost, "/api/v1/disputes/"+opened.Body["id"].(string)+"/close", buyerToken, "", nil); closed.Status != http.StatusOK {
		t.Fatalf("close dispute: %d %s", closed.Status, closed.Raw)
	}
	harness.deliverOrderEvent("orderGroup.delivered", orderId, harness.clock.Add(time.Hour))
	resumed, events, _ := harness.escrowOf(orderId)
	if resumed == nil || resumed.After(*first) || events != 1 {
		t.Fatalf("delivered -> disputed -> delivered extended the timer: %v -> %v (%d events)", first, resumed, events)
	}
	var scheduled int
	schema := harness.escrow.Application.Container.Settings.Money.DatabaseSchema
	_ = harness.Database.QueryRow(`SELECT count(*) FROM "` + schema + `".outbox_events WHERE event_type = 'escrow.releaseScheduled'`).Scan(&scheduled)
	if scheduled != 1 {
		t.Fatalf("the release schedule is announced once: %d", scheduled)
	}
}

func TestOrderEventForAnUnknownOrderIsAcknowledged(t *testing.T) {
	harness := startEscrowHarness(t)
	harness.deliverOrderEvent("orderGroup.delivered", uuid.NewString(), time.Now())
}
