package wallet

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	ledgercontainer "zudomart/modules/ledger/src/container"
	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	journalroutes "zudomart/modules/ledger/src/modules/journal/routes"
	"zudomart/modules/wallet/src/repositories"
)

func TestCoinTransfersAreRefusedBetweenBlockedUsers(t *testing.T) {
	harness := startWalletHarness(t, true)
	social := moneytesting.CreateEmptySchema(t, harness.Database, "social")
	if _, err := harness.Database.Exec(`CREATE TABLE ` + pgx.Identifier{social, "blocks"}.Sanitize() + ` ("blockerId" uuid NOT NULL, "blockedId" uuid NOT NULL, PRIMARY KEY ("blockerId", "blockedId"))`); err != nil {
		t.Fatal(err)
	}
	harness.wallet.Coins.Container.Blocks = repositories.SocialBlocks{Database: harness.Database, SocialSchema: social}
	sender, recipient, stranger := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.buyCoinsOnTheWeb(sender, "web-coins-1")
	if _, err := harness.Database.Exec(`INSERT INTO `+pgx.Identifier{social, "blocks"}.Sanitize()+` VALUES ($1, $2)`, recipient, sender); err != nil {
		t.Fatal(err)
	}
	token := harness.Tokens.UserAccessToken(sender)
	blocked := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "blocked-transfer-1", map[string]any{"recipientUserId": recipient, "coins": 10})
	if blocked.Status != http.StatusUnprocessableEntity || blocked.Body["code"] != "COIN_TRANSFER_BLOCKED" {
		t.Fatalf("blocked transfer: %d %s", blocked.Status, blocked.Raw)
	}
	if allowed := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "allowed-transfer-1", map[string]any{"recipientUserId": stranger, "coins": 10}); allowed.Status != http.StatusCreated {
		t.Fatalf("unblocked transfer: %d %s", allowed.Status, allowed.Raw)
	}
	if harness.balance(ledgermodels.UserSpendableCoinsAccount(recipient)) != 0 {
		t.Fatal("a blocked user received coins")
	}
}

func TestStaffReviewAndReverseCoinTransactionsWithClawbackAndRefund(t *testing.T) {
	harness := startWalletHarness(t, true)
	buyer, recipient, other := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.buyCoinsOnTheWeb(buyer, "web-coins-1")
	buyerToken := harness.Tokens.UserAccessToken(buyer)
	transfer := harness.Call(http.MethodPost, "/api/v1/coins/transfers", buyerToken, "review-transfer-1", map[string]any{"recipientUserId": recipient, "coins": 40})
	if transfer.Status != http.StatusCreated {
		t.Fatalf("transfer: %s", transfer.Raw)
	}
	if spent := harness.Call(http.MethodPost, "/api/v1/coins/transfers", harness.Tokens.UserAccessToken(recipient), "recipient-spend-1", map[string]any{"recipientUserId": other, "coins": 20}); spent.Status != http.StatusCreated {
		t.Fatalf("recipient spend: %s", spent.Raw)
	}
	reviewer := harness.Tokens.StaffTokens(uuid.NewString(), "money.coins.review")
	stepUp := reviewer.StepUp
	if denied := harness.Call(http.MethodGet, "/api/v1/admin/coins/transactions", harness.Tokens.StaffTokens(uuid.NewString(), "money.ledger.read").AccessToken, "", nil); denied.Status != http.StatusForbidden {
		t.Fatalf("staff without coins:review listed coin transactions: %d", denied.Status)
	}
	list := harness.Call(http.MethodGet, "/api/v1/admin/coins/transactions?search="+buyer, reviewer.AccessToken, "", nil)
	rows := list.Body["data"].([]any)
	if list.Status != http.StatusOK || len(rows) != 2 || rows[0].(map[string]any)["kind"] != "transfer" || rows[1].(map[string]any)["kind"] != "purchase" {
		t.Fatalf("list: %d %s", list.Status, list.Raw)
	}
	transferId := transfer.Body["transferId"].(string)
	purchaseId := rows[1].(map[string]any)["id"].(string)
	for _, raw := range rows {
		if row := raw.(map[string]any); row["reviewStatus"] != "not_required" || len(row["reviewFlags"].([]any)) != 0 {
			t.Fatalf("an unflagged transaction entered the review queue: %v", row)
		}
	}
	if queue := harness.Call(http.MethodGet, "/api/v1/admin/coins/transactions?status=pending_review&search="+buyer, reviewer.AccessToken, "", nil); len(queue.Body["data"].([]any)) != 0 {
		t.Fatalf("review queue holds unflagged transactions: %s", queue.Raw)
	}
	if notQueued := harness.Call(http.MethodPost, "/api/v1/admin/coins/transactions/"+purchaseId+"/mark-reviewed", reviewer.AccessToken, "", map[string]any{"reason": "Looks fine"}); notQueued.Status != http.StatusConflict || notQueued.Body["code"] != "COIN_TRANSACTION_NOT_PENDING" {
		t.Fatalf("mark reviewed outside the queue: %d %s", notQueued.Status, notQueued.Raw)
	}
	body := map[string]any{"reason": "Reported as account takeover"}
	if noStepUp := harness.Call(http.MethodPost, "/api/v1/admin/coins/transactions/"+transferId+"/reverse", reviewer.AccessToken, "reverse-key-1", body); noStepUp.Status != http.StatusForbidden {
		t.Fatalf("reversal without step-up: %d", noStepUp.Status)
	}
	if noKey := harness.Call(http.MethodPost, "/api/v1/admin/coins/transactions/"+transferId+"/reverse", reviewer.AccessToken, "", body, stepUp()); noKey.Status != http.StatusBadRequest {
		t.Fatalf("reversal without idempotency key: %d", noKey.Status)
	}
	reversed := harness.Call(http.MethodPost, "/api/v1/admin/coins/transactions/"+transferId+"/reverse", reviewer.AccessToken, "reverse-key-1", body, stepUp())
	replay := harness.Call(http.MethodPost, "/api/v1/admin/coins/transactions/"+transferId+"/reverse", reviewer.AccessToken, "reverse-key-1", body, stepUp())
	if reversed.Status != http.StatusOK || reversed.Body["reviewStatus"] != "reversed" || reversed.Body["clawbackShortfallCoins"].(float64) != 20 || replay.Headers.Get("Idempotent-Replayed") != "true" {
		t.Fatalf("reverse transfer: %d %s / %s", reversed.Status, reversed.Raw, replay.Raw)
	}
	if again := harness.Call(http.MethodPost, "/api/v1/admin/coins/transactions/"+transferId+"/reverse", reviewer.AccessToken, "reverse-key-2", body, stepUp()); again.Status != http.StatusConflict || again.Body["code"] != "COIN_TRANSACTION_REVERSED" {
		t.Fatalf("reversed twice: %d %s", again.Status, again.Raw)
	}
	if harness.balance(ledgermodels.UserSpendableCoinsAccount(buyer)) != 100 || harness.balance(ledgermodels.UserSpendableCoinsAccount(recipient)) != 0 || harness.balance(ledgermodels.UserCoinDebtAccount(recipient)) != 20 {
		t.Fatal("transfer reversal did not return 40 coins to the sender and claw back 20 into the recipient's debt")
	}
	if spend := harness.Call(http.MethodPost, "/api/v1/coins/transfers", buyerToken, "spend-before-reversal", map[string]any{"recipientUserId": other, "coins": 30}); spend.Status != http.StatusCreated {
		t.Fatalf("spend: %s", spend.Raw)
	}
	purchaseReversal := harness.Call(http.MethodPost, "/api/v1/admin/coins/transactions/"+purchaseId+"/reverse", reviewer.AccessToken, "reverse-key-3", body, stepUp())
	if purchaseReversal.Status != http.StatusOK || purchaseReversal.Body["transactionStatus"] != "refunded" || purchaseReversal.Body["clawbackShortfallCoins"].(float64) != 30 {
		t.Fatalf("reverse purchase: %d %s", purchaseReversal.Status, purchaseReversal.Raw)
	}
	if harness.Paystack.Calls("POST /refund") != 1 || harness.balance(ledgermodels.UserSpendableCoinsAccount(buyer)) != 0 || harness.balance(ledgermodels.UserCoinDebtAccount(buyer)) != 30 {
		t.Fatal("purchase reversal must refund through Paystack and claw back every coin")
	}
	if harness.balance(ledgermodels.RefundsPayableAccount("paystack", "NGN")) != 100_000 {
		t.Fatal("refund must stay payable until Paystack confirms it")
	}
	harness.AssertLedgerHealthy()

	ledger := ledgercontainer.NewLedgerContainer(harness.wallet.Coins.Container.Resources, moneytesting.MoneyModuleSettingsForTests("ledger", harness.LedgerSchema, harness.LedgerSchema))
	journalroutes.MountJournalRoutes(harness.Mux, ledger)
	auditor := harness.Tokens.StaffTokens(uuid.NewString(), "money.ledger.read")
	currencies := harness.Call(http.MethodGet, "/api/v1/admin/ledger/currencies", auditor.AccessToken, "", nil)
	if currencies.Status != http.StatusOK || len(currencies.Body["data"].([]any)) != 2 {
		t.Fatalf("currencies: %d %s", currencies.Status, currencies.Raw)
	}
	accounts := harness.Call(http.MethodGet, "/api/v1/admin/ledger/accounts?currency=COIN&limit=100", auditor.AccessToken, "", nil)
	var circulation, debt map[string]any
	for _, raw := range accounts.Body["data"].([]any) {
		account := raw.(map[string]any)
		switch account["code"] {
		case "platform:coinsInCirculation":
			circulation = account
		case "user:" + buyer + ":coinDebt":
			debt = account
		}
	}
	if circulation == nil || circulation["name"] != "Coins in circulation" || circulation["entryCount"].(float64) != 2 || debt == nil || debt["ownerId"] != buyer {
		t.Fatalf("accounts: %s", accounts.Raw)
	}
	entries := harness.Call(http.MethodGet, "/api/v1/admin/ledger/journal-entries?currency=NGN&accountCode=revenue:coinSales", auditor.AccessToken, "", nil)
	data := entries.Body["data"].([]any)
	if entries.Status != http.StatusOK || len(data) != 2 {
		t.Fatalf("entries: %d %s", entries.Status, entries.Raw)
	}
	newest := data[0].(map[string]any)
	if newest["kind"] != "coins.purchaseReversed" || newest["isBalanced"] != true || newest["totalDebits"].(map[string]any)["amountMinor"] != newest["totalCredits"].(map[string]any)["amountMinor"] || len(newest["legs"].([]any)) != 5 {
		t.Fatalf("journal entry view: %v", newest)
	}
	if invalid := harness.Call(http.MethodGet, "/api/v1/admin/ledger/accounts", auditor.AccessToken, "", nil); invalid.Status != http.StatusBadRequest {
		t.Fatalf("accounts without currency: %d", invalid.Status)
	}
}
