package services

import (
	"time"
)

type ConsentChoices struct {
	Analytics       bool
	Personalization bool
}

type InteractionInput struct {
	Event      string
	Payload    map[string]any
	OccurredAt time.Time
}

type InteractionActor struct {
	AccountId string
	SessionId string
}

var personalizationEvents = map[string]bool{
	"product.viewed": true, "product.clicked": true, "search.performed": true, "seller.viewed": true, "category.viewed": true,
}

var acceptedFromClients = map[string]bool{
	"product.viewed": true, "product.clicked": true, "product.addedToCart": true, "product.removedFromCart": true,
	"search.performed": true, "seller.viewed": true, "category.viewed": true,
}

var allowedPayloadKeys = []string{"productId", "storeId", "categoryId", "query", "surface", "position", "resultCount", "variantId"}

func IsAcceptedInteractionEvent(event string) bool { return acceptedFromClients[event] }

func BuildInteractionEventData(input InteractionInput, actor InteractionActor, consent ConsentChoices) (map[string]any, bool) {
	if !consent.Analytics || !IsAcceptedInteractionEvent(input.Event) {
		return nil, false
	}
	data := map[string]any{"occurredAt": input.OccurredAt.UTC().Format(time.RFC3339Nano)}
	for _, key := range allowedPayloadKeys {
		if value, present := input.Payload[key]; present {
			data[key] = value
		}
	}
	personalized := !personalizationEvents[input.Event] || consent.Personalization
	data["personalized"] = personalized
	if personalized && actor.AccountId != "" {
		data["actorId"] = actor.AccountId
	}
	if personalized && actor.SessionId != "" {
		data["sessionId"] = actor.SessionId
	}
	if !personalized {
		delete(data, "query")
	}
	return data, true
}
