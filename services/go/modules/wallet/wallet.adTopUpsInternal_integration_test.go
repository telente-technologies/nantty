package wallet

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func TestAdsServiceStartsAndTracksAccountTopUpsThroughTheInternalApi(t *testing.T) {
	harness := startWalletHarness(t, true)
	member, adAccount := uuid.NewString(), "acct-"+uuid.NewString()[:8]
	internal := http.Header{"X-Internal-Token": {strings.Repeat("w", 32)}}
	body := map[string]any{"userId": member, "amount": map[string]any{"amountMinor": 500_000, "currency": "NGN"}, "returnTo": "https://nantty.test/pay/return"}
	path := "/api/v1/internal/ads/accounts/" + adAccount + "/top-ups"
	if forged := harness.Call(http.MethodPost, path, "", "ads-top-up-0001", body); forged.Status != http.StatusUnauthorized {
		t.Fatalf("top-up without the internal token: %d", forged.Status)
	}
	if badReturn := harness.Call(http.MethodPost, path, "", "ads-top-up-0002", map[string]any{"userId": member, "amount": body["amount"], "returnTo": "https://evil.test/"}, internal); badReturn.Status != http.StatusBadRequest {
		t.Fatalf("unknown return URL accepted: %d", badReturn.Status)
	}
	harness.Payments.Application.Container.Settings.AdsReturnOrigins = []string{"http://localhost:3300"}
	accountReturn := "http://localhost:3300/accounts/" + adAccount + "/billing/return"
	if accepted := harness.Call(http.MethodPost, path, "", "ads-top-up-0003", map[string]any{"userId": member, "amount": body["amount"], "returnTo": accountReturn}, internal); accepted.Status != http.StatusCreated {
		t.Fatalf("ads account return page refused: %d %s", accepted.Status, accepted.Raw)
	}
	for _, unsafe := range []string{accountReturn + "?next=https://evil.test", "http://localhost:3300/accounts/" + adAccount + "/billing", "http://localhost:3301/accounts/" + adAccount + "/billing/return"} {
		if refused := harness.Call(http.MethodPost, path, "", "ads-top-up-0004", map[string]any{"userId": member, "amount": body["amount"], "returnTo": unsafe}, internal); refused.Status != http.StatusBadRequest {
			t.Fatalf("unsafe return URL %q accepted: %d", unsafe, refused.Status)
		}
	}
	started := harness.Call(http.MethodPost, path, "", "ads-top-up-0001", body, internal)
	replay := harness.Call(http.MethodPost, path, "", "ads-top-up-0001", body, internal)
	if started.Status != http.StatusCreated || started.Body["checkoutUrl"] == nil || replay.Body["reference"] != started.Body["reference"] {
		t.Fatalf("start: %d %s / %s", started.Status, started.Raw, replay.Raw)
	}
	reference := started.Body["reference"].(string)
	if pending := harness.Call(http.MethodGet, path+"/"+reference, "", "", nil, internal); pending.Body["status"] != "pending" || pending.Body["provider"] != "flutterwave" {
		t.Fatalf("pending status: %s", pending.Raw)
	}
	if other := harness.Call(http.MethodGet, "/api/v1/internal/ads/accounts/acct-other/top-ups/"+reference, "", "", nil, internal); other.Status != http.StatusNotFound {
		t.Fatalf("top-up visible under another ad account: %d", other.Status)
	}
	harness.Flutterwave.CompleteCheckout(reference, 0, 7_500, "card")
	done := harness.Call(http.MethodGet, path+"/"+reference, "", "", nil, internal)
	if done.Body["status"] != "succeeded" || done.Body["completedAt"] == nil || harness.balance(ledgermodels.AdvertiserPrepaidBalanceAccount(adAccount, "NGN")) != 500_000 {
		t.Fatalf("verified status: %s", done.Raw)
	}
	failing := harness.Call(http.MethodPost, path, "", "ads-top-up-0005", body, internal)
	failingReference := failing.Body["reference"].(string)
	harness.Flutterwave.FailCheckout(failingReference)
	if failed := harness.Call(http.MethodGet, path+"/"+failingReference, "", "", nil, internal); failed.Body["status"] != "failed" {
		t.Fatalf("failed charge status: %s", failed.Raw)
	}
	var events int
	var payload string
	schema := harness.wallet.Coins.Container.Settings.Money.DatabaseSchema
	if err := harness.Database.QueryRow(`SELECT count(*), COALESCE(max(payload::text), '') FROM `+pgx.Identifier{schema, "outbox_events"}.Sanitize()+` WHERE event_type = 'adBalance.topUpFailed' AND subject = $1`, adAccount).Scan(&events, &payload); err != nil {
		t.Fatal(err)
	}
	if events != 1 || !strings.Contains(payload, failingReference) || !strings.Contains(payload, `"fundedByUserId"`) {
		t.Fatalf("topUpFailed events = %d payload %s", events, payload)
	}
	if harness.balance(ledgermodels.AdvertiserPrepaidBalanceAccount(adAccount, "NGN")) != 500_000 {
		t.Fatal("a failed top-up changed the prepaid balance")
	}
	harness.AssertLedgerHealthy()
}
