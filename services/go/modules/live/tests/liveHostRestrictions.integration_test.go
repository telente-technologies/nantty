package live_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/jobs"
)

func accountHealthEnvelope(accountId string, canGoLive bool, occurredAt time.Time) []byte {
	data, _ := json.Marshal(map[string]any{"accountId": accountId, "status": "RESTRICTED", "restrictions": []string{"MONETISATION", "GOING_LIVE"}, "canMonetise": canGoLive, "canGoLive": canGoLive, "activeStrikeCount": 3, "copyrightStrikesInWindow": 3, "reason": "copyright_strike_issued"})
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": "accountHealth.changed", "source": "trust", "subject": accountId, "schemaVersion": 1, "occurredAt": occurredAt.UTC().Format(time.RFC3339), "data": json.RawMessage(data)})
	return envelope
}

func TestRestrictedHostsCannotGoLiveUntilTheirAccountRecovers(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host := harness.newUser("host", "buyer", "creator")
	handle := jobs.HandleLiveDomainEvent(harness.module.Container)
	restrictedAt := time.Now()
	if err := handle(context.Background(), accountHealthEnvelope(host.id.String(), false, restrictedAt)); err != nil {
		t.Fatal(err)
	}
	blocked := harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{"title": "Ranked grind", "category": "gaming"}, http.StatusForbidden)
	if blocked["code"] != "LIVE_RESTRICTED" {
		t.Fatalf("unexpected %v", blocked)
	}
	if err := handle(context.Background(), accountHealthEnvelope(host.id.String(), true, restrictedAt.Add(-time.Hour))); err != nil {
		t.Fatal(err)
	}
	harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{"title": "Ranked grind", "category": "gaming"}, http.StatusForbidden)
	if err := handle(context.Background(), accountHealthEnvelope(host.id.String(), true, restrictedAt.Add(time.Hour))); err != nil {
		t.Fatal(err)
	}
	harness.expect("POST", "/api/v1/lives", &host, "", map[string]any{"title": "Ranked grind", "category": "gaming"}, http.StatusCreated)
}
