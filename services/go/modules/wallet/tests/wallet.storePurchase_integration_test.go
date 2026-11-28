package wallet_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func TestInAppPurchaseBooksTheStoreFeeAndARefundClawsBackOrFlagsTheShortfall(t *testing.T) {
	harness := startWalletHarness(t, true)
	buyer := uuid.NewString()
	token := harness.Tokens.UserAccessToken(buyer)
	accountToken := harness.Call(http.MethodPost, "/api/v1/coins/iap/account-token", token, "", nil, http.Header{"X-Client-Platform": {"ios"}})
	if accountToken.Status != http.StatusOK || accountToken.Body["appAccountToken"] == "" {
		t.Fatalf("store token: %d %s", accountToken.Status, accountToken.Raw)
	}
	if repeated := harness.Call(http.MethodPost, "/api/v1/coins/iap/account-token", token, "", nil, http.Header{"X-Client-Platform": {"ios"}}); repeated.Body["appAccountToken"] != accountToken.Body["appAccountToken"] {
		t.Fatalf("store account token changed: %v != %v", repeated.Body, accountToken.Body)
	}
	googleAccountToken := harness.Call(http.MethodPost, "/api/v1/coins/iap/account-token", token, "", nil, http.Header{"X-Client-Platform": {"android"}})
	if googleAccountToken.Status != http.StatusOK || googleAccountToken.Body["obfuscatedAccountId"] == accountToken.Body["appAccountToken"] {
		t.Fatalf("store account tokens must be stable per store and distinct across stores: %d %s", googleAccountToken.Status, googleAccountToken.Raw)
	}
	receipt := map[string]any{"platform": "ios", "productId": "com.nantty.app.coins.tier3", "receipt": "valid-receipt", "transactionId": "apple-txn-1"}
	if missing := harness.Call(http.MethodPost, "/api/v1/coins/iap/receipts", token, "iap-key-missing-account-binding", receipt); missing.Status != http.StatusConflict {
		t.Fatalf("receipt without provider account binding must fail closed: %d %s", missing.Status, missing.Raw)
	}
	harness.storeTokens.Store("valid-receipt", accountToken.Body["appAccountToken"].(string))
	redeemed := harness.Call(http.MethodPost, "/api/v1/coins/iap/receipts", token, "iap-key-1", receipt)
	if redeemed.Status != http.StatusCreated || redeemed.Body["balance"].(float64) != 1000 {
		t.Fatalf("redeem: %d %s", redeemed.Status, redeemed.Raw)
	}
	if again := harness.Call(http.MethodPost, "/api/v1/coins/iap/receipts", token, "iap-key-2", receipt); again.Body["balance"].(float64) != 1000 {
		t.Fatalf("receipt redeemed twice: %v", again.Body)
	}
	if stolen := harness.Call(http.MethodPost, "/api/v1/coins/iap/receipts", harness.Tokens.UserAccessToken(uuid.NewString()), "iap-key-3", receipt); stolen.Status != http.StatusConflict {
		t.Fatalf("another account redeemed the receipt: %d", stolen.Status)
	}
	if harness.balance(ledgermodels.AppStoreFeeExpenseAccount("apple_iap", "USD")) != 300 || harness.balance(ledgermodels.PlatformProviderBalanceAccount("apple_iap", "USD")) != 699 {
		t.Fatal("store fee not booked as an expense")
	}
	if spend := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "spend-before-refund", map[string]any{"recipientUserId": uuid.NewString(), "coins": 500}); spend.Status != http.StatusCreated {
		t.Fatalf("spend: %d", spend.Status)
	}
	if response := harness.Call(http.MethodPost, "/webhooks/store-notifications/apple_iap", "", "", []byte("apple-txn-1")); response.Status != http.StatusOK {
		t.Fatalf("refund notification: %d %s", response.Status, response.Raw)
	}
	if harness.balance(ledgermodels.UserSpendableCoinsAccount(buyer)) != 0 || harness.balance(ledgermodels.UserCoinDebtAccount(buyer)) != 500 {
		t.Fatal("clawback did not recover the remaining coins and record the spent ones as debt")
	}
	var flags int
	schema := harness.wallet.Coins.Container.Settings.Money.DatabaseSchema
	_ = harness.Database.QueryRow(`SELECT count(*) FROM "`+schema+`".wallet_risk_flags WHERE user_id = $1`, buyer).Scan(&flags)
	if flags != 1 {
		t.Fatalf("risk flags = %d", flags)
	}
	harness.AssertLedgerHealthy()
}
