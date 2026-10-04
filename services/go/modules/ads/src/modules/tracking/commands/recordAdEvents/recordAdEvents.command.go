package recordadevents

import "zudomart/modules/ads/src/modules/tracking/dtos"

const MaximumEventsPerBatch = 100

type Command struct {
	UserId    string
	UserAgent string
	Events    []dtos.AdEventDto
}

var acceptedTypes = map[string]bool{"impression": true, "view": true, "complete": true, "click": true, "card_view": true, "skip": true, "hide": true}

func IsKnownEventType(eventType string) bool { return acceptedTypes[eventType] }
