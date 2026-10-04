package jobs

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/livesafetyincident"
	platformevents "zudomart/platform/events"
)

func testContainer() *container.Container {
	return &container.Container{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Now: time.Now}
}

func TestLiveSafetyScoreConsumerPoisonsMalformedAndNonAdvisoryScores(t *testing.T) {
	handler := HandleLiveSafetyScoreMessage(testContainer())
	for name, body := range map[string]string{
		"not json":       `{`,
		"not advisory":   `{"scoreId":"s1","liveId":"l1","kind":"frame","advisoryOnly":false}`,
		"unknown kind":   `{"scoreId":"s1","liveId":"l1","kind":"audio","advisoryOnly":true}`,
		"bad confidence": `{"scoreId":"s1","liveId":"l1","kind":"frame","advisoryOnly":true,"categories":[{"category":"gore","confidence":1.4}]}`,
	} {
		if err := handler(context.Background(), []byte(body)); !errors.Is(err, platformevents.ErrPoisonMessage) {
			t.Fatalf("%s: expected a poison message, got %v", name, err)
		}
	}
}

func TestLiveEndedConsumerIgnoresOtherEventsAndPoisonsBrokenOnes(t *testing.T) {
	handler := HandleLiveEndedMessage(testContainer())
	if err := handler(context.Background(), []byte(`{"id":"e1","type":"report.created","data":{}}`)); err != nil {
		t.Fatalf("other events must be ignored, got %v", err)
	}
	if err := handler(context.Background(), []byte(`{"id":"e1","type":"live.ended","data":{"liveId":""}}`)); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("a live.ended without a live id is poison, got %v", err)
	}
}

func TestIncidentsStayOpenWhenTheLiveEndsWhileHeldOrUrgent(t *testing.T) {
	appealed := time.Now()
	cases := []struct {
		incident ent.LiveSafetyIncident
		closes   bool
	}{
		{ent.LiveSafetyIncident{Priority: livesafetyincident.PriorityNormal}, true},
		{ent.LiveSafetyIncident{Priority: livesafetyincident.PriorityNormal, HoldActive: true}, false},
		{ent.LiveSafetyIncident{Priority: livesafetyincident.PriorityUrgent}, false},
		{ent.LiveSafetyIncident{Priority: livesafetyincident.PriorityLow, HashMatch: true}, false},
		{ent.LiveSafetyIncident{Priority: livesafetyincident.PriorityLow, AppealedAt: &appealed}, false},
		{ent.LiveSafetyIncident{Priority: livesafetyincident.PriorityNormal, Resolution: "keep_paused"}, false},
	}
	for index, testCase := range cases {
		if got := ShouldCloseIncidentWhenLiveEnds(&testCase.incident); got != testCase.closes {
			t.Fatalf("case %d: got %v want %v", index, got, testCase.closes)
		}
	}
}
