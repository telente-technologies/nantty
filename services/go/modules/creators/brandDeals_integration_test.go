package creators

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/creators/src/repositories"
)

func TestBrandDealsAreAPrivateLogForApprovedCreators(t *testing.T) {
	creator, outsider := uuid.NewString(), uuid.NewString()
	harness := startHttpHarness(t, repositories.StaticCreatorsDirectory{})
	harness.makeCreator(creator, "starter")
	creatorToken, outsiderToken := harness.tokens.UserAccessToken(creator), harness.tokens.UserAccessToken(outsider)
	deal := map[string]any{"brandName": "Ankara Co", "amountMinor": 25_000_000, "currency": "NGN", "startsAt": "2026-10-01T00:00:00Z", "endsAt": "2026-10-31T00:00:00Z", "disclosure": "#ad paid partnership"}

	if status, _ := harness.call(http.MethodPost, "/api/v1/creators/brand-deals", "", "deal-key-0001", deal); status != http.StatusUnauthorized {
		t.Fatalf("anonymous: %d", status)
	}
	if status, body := harness.call(http.MethodPost, "/api/v1/creators/brand-deals", creatorToken, "", deal); status != http.StatusBadRequest || body["code"] != "IDEMPOTENCY_KEY_REQUIRED" {
		t.Fatalf("missing key: %d %v", status, body)
	}
	if status, body := harness.call(http.MethodPost, "/api/v1/creators/brand-deals", outsiderToken, "deal-key-0001", deal); status != http.StatusForbidden || body["code"] != "CREATOR_PROGRAM_REQUIRED" {
		t.Fatalf("non-creator: %d %v", status, body)
	}
	unknownField := map[string]any{"brandName": "X", "amountMinor": 1, "currency": "NGN", "startsAt": "2026-10-01T00:00:00Z", "disclosure": "#ad", "payout": true}
	if status, _ := harness.call(http.MethodPost, "/api/v1/creators/brand-deals", creatorToken, "deal-key-0002", unknownField); status != http.StatusBadRequest {
		t.Fatalf("unknown fields are rejected: %d", status)
	}
	backwards := map[string]any{"brandName": "X", "amountMinor": -5, "currency": "XYZ", "startsAt": "2026-10-10T00:00:00Z", "endsAt": "2026-10-01T00:00:00Z", "disclosure": " "}
	if status, body := harness.call(http.MethodPost, "/api/v1/creators/brand-deals", creatorToken, "deal-key-0003", backwards); status != http.StatusBadRequest {
		t.Fatalf("invalid deal: %d %v", status, body)
	}

	status, created := harness.call(http.MethodPost, "/api/v1/creators/brand-deals", creatorToken, "deal-key-0004", deal)
	if status != http.StatusCreated || created["brandName"] != "Ankara Co" || created["amount"].(map[string]any)["amountMinor"] != float64(25_000_000) {
		t.Fatalf("record: %d %v", status, created)
	}
	if status, replay := harness.call(http.MethodPost, "/api/v1/creators/brand-deals", creatorToken, "deal-key-0004", deal); status != http.StatusCreated || replay["id"] != created["id"] {
		t.Fatalf("replay returns the same deal: %d %v", status, replay)
	}
	changed := map[string]any{"brandName": "Other", "amountMinor": 1, "currency": "NGN", "startsAt": "2026-10-01T00:00:00Z", "disclosure": "#ad"}
	if status, body := harness.call(http.MethodPost, "/api/v1/creators/brand-deals", creatorToken, "deal-key-0004", changed); status != http.StatusConflict || body["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("reused key with a different body: %d %v", status, body)
	}

	_, listed := harness.call(http.MethodGet, "/api/v1/creators/brand-deals", creatorToken, "", nil)
	if items := listed["data"].([]any); len(items) != 1 {
		t.Fatalf("list: %v", listed)
	}
	_, others := harness.call(http.MethodGet, "/api/v1/creators/brand-deals", outsiderToken, "", nil)
	if items := others["data"].([]any); len(items) != 0 {
		t.Fatalf("deals are private to their creator: %v", others)
	}
	dealId := created["id"].(string)
	if status, _ := harness.call(http.MethodDelete, "/api/v1/creators/brand-deals/"+dealId, outsiderToken, "", nil); status != http.StatusNotFound {
		t.Fatalf("someone else cannot remove it: %d", status)
	}
	if status, _ := harness.call(http.MethodDelete, "/api/v1/creators/brand-deals/"+dealId, creatorToken, "", nil); status != http.StatusNoContent {
		t.Fatalf("remove: %d", status)
	}
	if status, _ := harness.call(http.MethodDelete, "/api/v1/creators/brand-deals/"+dealId, creatorToken, "", nil); status != http.StatusNotFound {
		t.Fatalf("second remove: %d", status)
	}
}
