package live_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent/livesafetystate"
	"nantty/modules/live/src/jobs"
)

func liveSafetyEnvelope(eventType, liveId, incidentId string) []byte {
	data, _ := json.Marshal(map[string]any{"liveId": liveId, "incidentId": incidentId, "category": "violence", "reason": "unsafe broadcast", "source": "classifier"})
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": eventType, "source": "trust", "subject": liveId, "schemaVersion": 1, "occurredAt": time.Now().UTC().Format(time.RFC3339), "data": json.RawMessage(data)})
	return envelope
}

func TestReleasingAnOlderIncidentKeepsTheHoldOfTheCurrentIncident(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "buyer", "creator")
	liveId := harness.goLive(host, nil)
	handle := jobs.HandleLiveDomainEvent(harness.module.Container)
	first, second := uuid.NewString(), uuid.NewString()
	for _, envelope := range [][]byte{
		liveSafetyEnvelope("live.safetyHold", liveId, first),
		liveSafetyEnvelope("live.safetyHold", liveId, second),
		liveSafetyEnvelope("live.safetyReleased", liveId, first),
	} {
		if err := handle(context.Background(), envelope); err != nil {
			t.Fatal(err)
		}
	}
	held := func() bool {
		state, err := harness.module.Container.Client.LiveSafetyState.Query().Where(livesafetystate.LiveID(uuid.MustParse(liveId))).Only(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		return state.HoldActive
	}
	if !held() {
		t.Fatal("a redelivered release for an older incident must not lift the current incident's hold")
	}
	if err := handle(context.Background(), liveSafetyEnvelope("live.safetyReleased", liveId, second)); err != nil {
		t.Fatal(err)
	}
	if held() {
		t.Fatal("releasing the current incident lifts the hold")
	}
}
