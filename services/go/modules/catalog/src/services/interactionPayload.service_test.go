package services

import (
	"strings"
	"testing"
	"time"
)

func TestInteractionPayloadRejectsMalformedValues(t *testing.T) {
	payload := map[string]any{
		"productId": map[string]any{"nested": strings.Repeat("x", 1000)}, "storeId": "not-a-uuid", "categoryId": "0192f0a0-0000-7000-8000-0000000000aa",
		"query": strings.Repeat("q", 5000), "surface": "<script>", "position": 1.5, "resultCount": -3,
	}
	data, kept := BuildInteractionEventData(InteractionInput{Event: "search.performed", Payload: payload, OccurredAt: time.Now()},
		InteractionActor{AccountId: "a"}, ConsentChoices{Analytics: true, Personalization: true})
	if !kept {
		t.Fatal("event should be kept with its invalid fields stripped")
	}
	for _, key := range []string{"productId", "storeId", "surface", "position", "resultCount"} {
		if _, found := data[key]; found {
			t.Fatalf("invalid %s was copied: %v", key, data[key])
		}
	}
	if data["categoryId"] != "0192f0a0-0000-7000-8000-0000000000aa" || len([]rune(data["query"].(string))) != maximumInteractionQueryLength {
		t.Fatalf("valid fields were not kept or bounded: %v", data)
	}
}

func TestInteractionPayloadKeepsWellFormedNumbers(t *testing.T) {
	data, _ := BuildInteractionEventData(InteractionInput{Event: "product.clicked", Payload: map[string]any{"position": float64(4), "surface": "mart_home"}, OccurredAt: time.Now()},
		InteractionActor{}, ConsentChoices{Analytics: true})
	if data["position"] != 4 || data["surface"] != "mart_home" {
		t.Fatalf("unexpected data %v", data)
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
