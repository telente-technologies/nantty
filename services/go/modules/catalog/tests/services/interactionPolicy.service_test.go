package services_test

import (
	"testing"
	"time"

	"nantty/modules/catalog/src/services"
)

func TestInteractionsAreDroppedWithoutAnalyticsConsent(t *testing.T) {
	_, kept := services.BuildInteractionEventData(services.InteractionInput{Event: "product.viewed", OccurredAt: time.Now()}, services.InteractionActor{AccountId: "a"}, services.ConsentChoices{})
	if kept {
		t.Fatal("event kept without analytics consent")
	}
}

func TestPersonalizationEventsLoseActorWithoutPersonalizationConsent(t *testing.T) {
	input := services.InteractionInput{Event: "search.performed", Payload: map[string]any{"query": "shoes", "surface": "mart"}, OccurredAt: time.Now()}
	data, kept := services.BuildInteractionEventData(input, services.InteractionActor{AccountId: "a", SessionId: "s"}, services.ConsentChoices{Analytics: true})
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
	data, kept := services.BuildInteractionEventData(services.InteractionInput{Event: "product.viewed", Payload: map[string]any{"productId": "p", "ignored": "x"}, OccurredAt: time.Now()},
		services.InteractionActor{AccountId: "a", SessionId: "s"}, services.ConsentChoices{Analytics: true, Personalization: true})
	if !kept || data["actorId"] != "a" || data["sessionId"] != "s" {
		t.Fatalf("unexpected data %v", data)
	}
	if _, found := data["ignored"]; found {
		t.Fatal("unknown payload key was copied")
	}
}

func TestSearchProductClicksHashQueryAndPreserveRankSignals(t *testing.T) {
	data, kept := services.BuildInteractionEventData(services.InteractionInput{
		Event: "product.clicked",
		Payload: map[string]any{
			"productId":   "0192a4f0-0000-7000-8000-000000000001",
			"surface":     "search",
			"query":       "linen shirts",
			"resultCount": float64(12),
			"position":    float64(2),
		},
		OccurredAt: time.Now(),
	}, services.InteractionActor{AccountId: "account-1", SessionId: "session-1", IdHashSecret: "id-key", IntelligenceKey: "shared-key"}, services.ConsentChoices{Analytics: true, Personalization: true})
	if !kept {
		t.Fatal("expected consented product search click to be kept")
	}
	if data["query"] != nil {
		t.Fatal("raw search query must not be placed on the outbox event")
	}
	if queryHash, ok := data["queryHash"].(string); !ok || len(queryHash) != 42 || queryHash[:2] != "q_" {
		t.Fatalf("expected opaque query hash, got %v", data["queryHash"])
	}
	if data["productId"] != "0192a4f0-0000-7000-8000-000000000001" || data["resultCount"] != 12 || data["position"] != 2 {
		t.Fatalf("product ranking signal missing from interaction: %v", data)
	}
	published := services.IntelligenceInteractionPayload(data, "id-key", "shared-key")
	if published["actorId"] == "account-1" || published["sessionId"] != nil {
		t.Fatalf("raw account/session identifiers must not be published: %v", published)
	}
}

func TestClientsCannotReportPurchases(t *testing.T) {
	if _, kept := services.BuildInteractionEventData(services.InteractionInput{Event: "product.purchased"}, services.InteractionActor{}, services.ConsentChoices{Analytics: true, Personalization: true}); kept {
		t.Fatal("purchases may only come from orders")
	}
}
