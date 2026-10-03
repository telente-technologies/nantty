package services

import (
	"testing"
	"time"
)

func TestInteractionsAreDroppedWithoutAnalyticsConsent(t *testing.T) {
	_, kept := BuildInteractionEventData(InteractionInput{Event: "product.viewed", OccurredAt: time.Now()}, InteractionActor{AccountId: "a"}, ConsentChoices{})
	if kept {
		t.Fatal("event kept without analytics consent")
	}
}

func TestPersonalizationEventsLoseActorWithoutPersonalizationConsent(t *testing.T) {
	input := InteractionInput{Event: "search.performed", Payload: map[string]any{"query": "shoes", "surface": "mart"}, OccurredAt: time.Now()}
	data, kept := BuildInteractionEventData(input, InteractionActor{AccountId: "a", SessionId: "s"}, ConsentChoices{Analytics: true})
	if !kept || data["personalized"] != false {
		t.Fatalf("expected an aggregated event, got %v kept=%v", data, kept)
	}
	if _, found := data["actorId"]; found {
		t.Fatal("actor leaked into an aggregated event")
	}
	if _, found := data["query"]; found {
		t.Fatal("search text leaked into an aggregated event")
	}
}

func TestPersonalizedEventsKeepActorWithConsent(t *testing.T) {
	data, kept := BuildInteractionEventData(InteractionInput{Event: "product.viewed", Payload: map[string]any{"productId": "p", "ignored": "x"}, OccurredAt: time.Now()},
		InteractionActor{AccountId: "a", SessionId: "s"}, ConsentChoices{Analytics: true, Personalization: true})
	if !kept || data["actorId"] != "a" || data["sessionId"] != "s" {
		t.Fatalf("unexpected data %v", data)
	}
	if _, found := data["ignored"]; found {
		t.Fatal("unknown payload key was copied")
	}
}

func TestClientsCannotReportPurchases(t *testing.T) {
	if _, kept := BuildInteractionEventData(InteractionInput{Event: "product.purchased"}, InteractionActor{}, ConsentChoices{Analytics: true, Personalization: true}); kept {
		t.Fatal("purchases may only come from orders")
	}
}
