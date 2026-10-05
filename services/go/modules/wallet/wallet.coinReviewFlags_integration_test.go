package wallet

import (
	"fmt"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func reviewFlagsOf(row map[string]any) []string {
	flags := []string{}
	for _, flag := range row["reviewFlags"].([]any) {
		flags = append(flags, flag.(string))
	}
	return flags
}

func (harness *walletHarness) staffCoinRows(token, query string) []map[string]any {
	harness.T.Helper()
	response := harness.Call(http.MethodGet, "/api/v1/admin/coins/transactions?limit=100&"+query, token, "", nil)
	if response.Status != http.StatusOK {
		harness.T.Fatalf("staff list: %d %s", response.Status, response.Raw)
	}
	rows := []map[string]any{}
	for _, raw := range response.Body["data"].([]any) {
		rows = append(rows, raw.(map[string]any))
	}
	return rows
}

func (harness *walletHarness) buyCoinsWithKey(userId, packageId, key string) {
	harness.T.Helper()
	started := harness.Call(http.MethodPost, "/api/v1/coins/purchases", harness.Tokens.UserAccessToken(userId), key, map[string]any{"packageId": packageId}, http.Header{"X-Client-Region": {"NG"}})
	if started.Status != http.StatusCreated {
		harness.T.Fatalf("start purchase: %d %s", started.Status, started.Raw)
	}
	harness.CompleteCheckoutThroughWebhook(started.Body["reference"].(string), 0, 2_000)
}

func TestOnlyFlaggedCoinTransactionsEnterTheReviewQueueWithTheRulesThatFlaggedThem(t *testing.T) {
	harness := startWalletHarness(t, true)
	reviewer := harness.Tokens.StaffTokens(uuid.NewString(), "money.coins.review")
	walletSchema := harness.wallet.Coins.Container.Settings.Money.DatabaseSchema

	frequentBuyer := uuid.NewString()
	for attempt := range 6 {
		harness.buyCoinsWithKey(frequentBuyer, "web-coins-1", fmt.Sprintf("velocity-buy-%02d", attempt))
	}
	purchases := harness.staffCoinRows(reviewer.AccessToken, "kind=purchase&search="+frequentBuyer)
	flagged := 0
	for _, row := range purchases {
		if row["reviewStatus"] == "pending_review" {
			flagged++
			if !slices.Equal(reviewFlagsOf(row), []string{"coin_purchase_velocity"}) || row["chargebackRisk"] != "medium" {
				t.Fatalf("velocity flag: %v", row)
			}
		}
	}
	if len(purchases) != 6 || flagged != 1 {
		t.Fatalf("only the sixth purchase in a day should be flagged: %d of %d", flagged, len(purchases))
	}

	sender, flaggedRecipient, cleanRecipient := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.buyCoinsOnTheWeb(sender, "web-coins-3")
	if _, err := harness.Database.Exec(`INSERT INTO `+pgx.Identifier{walletSchema, "wallet_risk_flags"}.Sanitize()+` (id, created_at, user_id, reason, subject_id, coins_shortfall) VALUES ($1, $2, $3, 'storeRefundAfterCoinsSpent', '', 5)`, uuid.Must(uuid.NewV7()), time.Now(), flaggedRecipient); err != nil {
		t.Fatal(err)
	}
	token := harness.Tokens.UserAccessToken(sender)
	clean := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "flag-clean-transfer", map[string]any{"recipientUserId": cleanRecipient, "coins": 4})
	risky := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "flag-risky-transfer", map[string]any{"recipientUserId": flaggedRecipient, "coins": 4})
	for attempt := range 9 {
		harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, fmt.Sprintf("flag-burst-transfer-%02d", attempt), map[string]any{"recipientUserId": cleanRecipient, "coins": 4})
	}
	burst := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "flag-burst-transfer-last", map[string]any{"recipientUserId": cleanRecipient, "coins": 4})
	byId := map[string]map[string]any{}
	for _, row := range harness.staffCoinRows(reviewer.AccessToken, "kind=transfer&search="+sender) {
		byId[row["id"].(string)] = row
	}
	if row := byId[clean.Body["transferId"].(string)]; row["reviewStatus"] != "not_required" {
		t.Fatalf("clean transfer was queued: %v", row)
	}
	if row := byId[risky.Body["transferId"].(string)]; row["reviewStatus"] != "pending_review" || !slices.Equal(reviewFlagsOf(row), []string{"open_wallet_risk_flag"}) || row["chargebackRisk"] != "high" {
		t.Fatalf("transfer to a flagged account: %v", row)
	}
	if row := byId[burst.Body["transferId"].(string)]; row["reviewStatus"] != "pending_review" || !slices.Contains(reviewFlagsOf(row), "transfer_burst") {
		t.Fatalf("eleventh transfer within an hour: %v", row)
	}

	chargedBack := uuid.NewString()
	harness.buyCoinsWithKey(chargedBack, "web-coins-1", "chargeback-buy-1")
	paymentsSchema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	if _, err := harness.Database.Exec(`INSERT INTO `+pgx.Identifier{paymentsSchema, "provider_disputes"}.Sanitize()+` (id, created_at, provider, provider_dispute_id, payment_intent_id, updated_at)
		SELECT $1, now(), 'paystack', 'dsp_test_1', id, now() FROM `+pgx.Identifier{paymentsSchema, "payment_intents"}.Sanitize()+` WHERE owner_user_id = $2 LIMIT 1`, uuid.Must(uuid.NewV7()), chargedBack); err != nil {
		t.Fatal(err)
	}
	harness.buyCoinsWithKey(chargedBack, "web-coins-1", "chargeback-buy-2")
	queue := harness.staffCoinRows(reviewer.AccessToken, "status=pending_review&search="+chargedBack)
	if len(queue) != 1 || !slices.Equal(reviewFlagsOf(queue[0]), []string{"chargeback_history"}) {
		t.Fatalf("purchase after a chargeback: %v", queue)
	}
	purchaseId := queue[0]["id"].(string)
	detail := harness.Call(http.MethodGet, "/api/v1/admin/coins/transactions/"+purchaseId, reviewer.AccessToken, "", nil)
	if history := detail.Body["history"].([]any); len(history) != 2 || history[1].(map[string]any)["action"] != "flagged" || history[1].(map[string]any)["note"] != "chargeback_history" {
		t.Fatalf("flag history: %s", detail.Raw)
	}
	if reviewed := harness.Call(http.MethodPost, "/api/v1/admin/coins/transactions/"+purchaseId+"/mark-reviewed", reviewer.AccessToken, "", map[string]any{"reason": "Dispute was won"}); reviewed.Status != http.StatusOK || reviewed.Body["reviewStatus"] != "reviewed" {
		t.Fatalf("mark reviewed: %d %s", reviewed.Status, reviewed.Raw)
	}
	harness.AssertLedgerHealthy()
}
