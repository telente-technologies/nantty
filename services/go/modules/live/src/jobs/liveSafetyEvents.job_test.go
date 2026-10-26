package jobs

import (
	"context"
	"errors"
	"testing"

	"nantty/modules/live/src/container"
	platformevents "nantty/platform/events"
)

func TestLiveSafetyEventsAreRecognised(t *testing.T) {
	for _, eventType := range []string{"live.safetyHold", "live.safetyReleased", "live.safetyWarning", "live.samplingBoosted", "live.moderatorEnded"} {
		if !IsLiveSafetyEvent(eventType) {
			t.Fatalf("%s should be handled by the safety consumer", eventType)
		}
	}
	if IsLiveSafetyEvent("live.ended") || IsLiveSafetyEvent("content.visibilityChanged") {
		t.Fatal("other events must not be routed to the safety consumer")
	}
}

func TestLiveSafetyConsumerPoisonsMalformedEvents(t *testing.T) {
	handler := HandleLiveDomainEvent(&container.Container{})
	for name, body := range map[string]string{
		"not json":         `{`,
		"missing live":     `{"id":"e1","type":"live.safetyHold","data":{"incidentId":"i1"}}`,
		"bad boost moment": `{"id":"e1","type":"live.samplingBoosted","data":{"liveId":"not-a-uuid","boostUntil":"soon"}}`,
	} {
		if err := handler(context.Background(), []byte(body)); !errors.Is(err, platformevents.ErrPoisonMessage) {
			t.Fatalf("%s: expected poison, got %v", name, err)
		}
	}
}
