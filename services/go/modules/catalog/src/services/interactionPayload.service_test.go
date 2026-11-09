package services

import (
	"strings"
	"testing"
	"time"
)

func TestInteractionPayloadRejectsMalformedValues(t *testing.T) {
	payload := map[string]any{
		"productId": map[string]any{"nested": strings.Repeat("x", 1000)}, "storeId": "not-a-uuid", "categoryId": "0192f0a0-0000-7000-8000-0000000000aa",
		"query": strings.Repeat("q", 5000), "surface": "<script>", "position": 1.5, "resultCount": -3, "quantity": float64(10_001),
	}
	data, kept := BuildInteractionEventData(InteractionInput{Event: "search.performed", Payload: payload, OccurredAt: time.Now()},
		InteractionActor{AccountId: "a"}, ConsentChoices{Analytics: true, Personalization: true})
	if !kept {
		t.Fatal("event should be kept with its invalid fields stripped")
	}
	for _, key := range []string{"productId", "storeId", "surface", "position", "resultCount", "quantity"} {
		if _, found := data[key]; found {
			t.Fatalf("invalid %s was copied: %v", key, data[key])
		}
	}
	if data["categoryId"] != "0192f0a0-0000-7000-8000-0000000000aa" || data["queryHash"] == nil {
		t.Fatalf("valid fields were not kept or bounded: %v", data)
	}
	if _, found := data["query"]; found {
		t.Fatalf("raw search text must not enter the outbox payload: %v", data)
	}
}

func TestHashSearchQueryMatchesIntelligenceHasherContract(t *testing.T) {
	if actual := HashSearchQuery(" Shoes ", "test-key", "shared"); actual != "q_e57b8eee5257afd69de3da0ee901bd9ebabd40e9" {
		t.Fatalf("unexpected query hash: %s", actual)
	}
}

func TestIntelligenceInteractionPayloadUsesSamePseudonymAsRecommendationCalls(t *testing.T) {
	const accountId = "0192f0a0-0000-7000-8000-0000000000aa"
	data := map[string]any{"actorId": accountId, "sessionId": "session-secret", "productId": "0192f0a0-0000-7000-8000-0000000000bb"}
	published := IntelligenceInteractionPayload(data, "id-key", "shared-key")
	want := HashIntelligenceUserId(accountId, "id-key", "shared-key")
	if published["actorId"] != want {
		t.Fatalf("outbox actor key = %v, want recommendation pseudonym %s", published["actorId"], want)
	}
	if data["actorId"] != accountId {
		t.Fatalf("catalog-local actor id was mutated: %v", data["actorId"])
	}
	if published["productId"] != data["productId"] {
		t.Fatalf("interaction payload fields were not preserved: %v", published)
	}
	if _, exists := published["sessionId"]; exists {
		t.Fatalf("session identifiers must not be exported to intelligence: %v", published)
	}
}

func TestInteractionPayloadKeepsWellFormedNumbers(t *testing.T) {
	data, _ := BuildInteractionEventData(InteractionInput{Event: "product.addedToCart", Payload: map[string]any{"position": float64(4), "quantity": float64(3), "surface": "mart_home"}, OccurredAt: time.Now()},
		InteractionActor{}, ConsentChoices{Analytics: true})
	if data["position"] != 4 || data["quantity"] != 3 || data["surface"] != "mart_home" {
		t.Fatalf("unexpected data %v", data)
	}
}

func TestInteractionPayloadDropsInvalidProductQuantity(t *testing.T) {
	for _, quantity := range []float64{0, 1.5, 10_001} {
		data, _ := BuildInteractionEventData(InteractionInput{Event: "product.addedToCart", Payload: map[string]any{"quantity": quantity}, OccurredAt: time.Now()},
			InteractionActor{}, ConsentChoices{Analytics: true})
		if _, found := data["quantity"]; found {
			t.Fatalf("invalid quantity %v was copied: %v", quantity, data)
		}
	}
}

func TestInteractionDedupeKeyCollapsesRepeatsOfTheSameTarget(t *testing.T) {
	first := InteractionDedupeKey("product.viewed", map[string]any{"productId": "p1", "storeId": "s1", "occurredAt": "a"})
	second := InteractionDedupeKey("product.viewed", map[string]any{"productId": "p1", "storeId": "s1", "occurredAt": "b"})
	other := InteractionDedupeKey("product.viewed", map[string]any{"productId": "p2", "storeId": "s1"})
	if first != second || first == other {
		t.Fatalf("dedupe keys wrong: %q %q %q", first, second, other)
	}
}
