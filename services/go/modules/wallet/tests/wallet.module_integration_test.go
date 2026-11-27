package wallet_test

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"nantty/modules/ledger/src/databases"
	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/wallet/src"
	"nantty/modules/wallet/src/configs"
	walletmigrations "nantty/modules/wallet/src/migrations"
)

type fakeStoreVerifier struct {
	store string
}

func (verifier fakeStoreVerifier) Store() string              { return verifier.store }
func (verifier fakeStoreVerifier) StoreFeeBasisPoints() int64 { return 3000 }

func (verifier fakeStoreVerifier) VerifyPurchaseReceipt(_ context.Context, receipt interfaces.StoreReceipt) (interfaces.VerifiedStorePurchase, error) {
	if receipt.ReceiptData != "valid-receipt" {
		return interfaces.VerifiedStorePurchase{}, interfaces.ErrStoreReceiptInvalid
	}
	return interfaces.VerifiedStorePurchase{StoreTransactionId: receipt.TransactionId, ProductId: receipt.ProductId, PriceMinor: 999, Currency: "USD", Environment: "sandbox"}, nil
}

func (verifier fakeStoreVerifier) VerifySignedRefundNotification(_ context.Context, rawBody []byte, _ http.Header) (interfaces.StoreRefundNotification, error) {
	return interfaces.StoreRefundNotification{NotificationId: "notification-" + string(rawBody), StoreTransactionId: string(rawBody)}, nil
}

type walletHarness struct {
	*paymentstesting.MoneyHarness
	wallet        *src.Module
	creatorSchema string
}

func startWalletHarness(t *testing.T, requireReview bool, adjustments ...func(*configs.WalletSettings)) *walletHarness {
	t.Helper()
	money := paymentstesting.StartMoneyHarnessWithPayments(t, map[string]interfaces.StoreReceiptVerifier{"apple_iap": fakeStoreVerifier{store: "apple_iap"}})
	walletSchema := moneytesting.CreateFreshSchemaWithMigrations(t, money.Database, "wallet", walletmigrations.Files)
	creatorSchema := moneytesting.CreateEmptySchema(t, money.Database, "creators")
	if _, err := money.Database.Exec("CREATE TABLE " + pgx.Identifier{creatorSchema, "creator_program_members"}.Sanitize() + " (user_id text PRIMARY KEY, status text NOT NULL, suspended_at timestamptz NULL)"); err != nil {
		t.Fatal(err)
	}
	var walletTables string
	if err := money.Database.QueryRow("SELECT COALESCE(string_agg(table_name, ',' ORDER BY table_name), '') FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('coin_packages', 'coin_purchases', 'coin_transfers')", walletSchema).Scan(&walletTables); err != nil {
		t.Fatal(err)
	}
	if walletTables != "coin_packages,coin_purchases,coin_transfers" {
		t.Fatalf("wallet test schema is missing required migrations: %s", walletTables)
	}
	settings := configs.WalletSettings{
		Money:                        moneytesting.MoneyModuleSettingsForTests("wallet", walletSchema, money.LedgerSchema),
		CoinTransferFeeBps:           200,
		CoinCashValueMinorByCurrency: configs.ParseCurrencyAmounts("NGN:1000,USD:1"),
		MinimumPayoutMinorByCurrency: configs.ParseCurrencyAmounts("NGN:1000,USD:1000"),
		MinimumWithdrawalMinor:       100, DataEncryptionKey: bytes.Repeat([]byte{9}, 32),
		DefaultCurrency: "NGN", TrustedCountryHeader: "CloudFront-Viewer-Country", WithdrawalsRequireReview: requireReview, PayoutRunInterval: time.Hour,
		CreatorTransferMinimum:      configs.ParseCurrencyAmounts("NGN:10000"),
		CoinNetValueMinorByCurrency: configs.ParseCurrencyAmounts("NGN:1000,USD:1"),
		CoinChannelFeeBps:           configs.ParseChannelFees("web:200,ios:3000,android:1500"),
		CreatorProgramSchema:        creatorSchema,
		InternalApiToken:            strings.Repeat("w", 32), AdPrepaidRefundsEnabled: true, SellerReserveHoldDays: 90,
	}
	for _, adjust := range adjustments {
		adjust(&settings)
	}
	module, err := src.StartWalletModuleWithSettings(context.Background(), settings, money.Dependencies, money.Overrides(), money.Payments.Application.Gateway)
	if err != nil {
		t.Fatal(err)
	}
	money.MountModule(module)
	return &walletHarness{MoneyHarness: money, wallet: module, creatorSchema: creatorSchema}
}

func (harness *walletHarness) approveCreator(userId string) {
	harness.T.Helper()
	query := "INSERT INTO " + pgx.Identifier{harness.creatorSchema, "creator_program_members"}.Sanitize() + " (user_id, status) VALUES ($1, 'approved') ON CONFLICT (user_id) DO UPDATE SET status = 'approved'"
	if _, err := harness.Database.Exec(query, userId); err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *walletHarness) setCreatorStatus(userId, status string) {
	harness.T.Helper()
	query := "INSERT INTO " + pgx.Identifier{harness.creatorSchema, "creator_program_members"}.Sanitize() + " (user_id, status) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, suspended_at = CASE WHEN EXCLUDED.status = 'approved' THEN NULL ELSE creator_program_members.suspended_at END"
	if _, err := harness.Database.Exec(query, userId, status); err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *walletHarness) suspendCreator(userId string) {
	harness.T.Helper()
	query := "UPDATE " + pgx.Identifier{harness.creatorSchema, "creator_program_members"}.Sanitize() + " SET suspended_at = NOW() WHERE user_id = $1"
	if _, err := harness.Database.Exec(query, userId); err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *walletHarness) post(entry ledgermodels.JournalEntryRequest) {
	harness.T.Helper()
	err := databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.Ledger.PostBalancedJournalEntry(ctx, transaction, entry)
		return err
	})
	if err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *walletHarness) balance(account ledgermodels.AccountRef) int64 {
	balance, err := harness.Ledger.ReadAccountBalance(context.Background(), harness.Database, account)
	if err != nil {
		harness.T.Fatal(err)
	}
	return balance
}

func (harness *walletHarness) buyCoinsOnTheWeb(userId, packageId string) {
	harness.T.Helper()
	started := harness.Call(http.MethodPost, "/api/v1/coins/purchases", harness.Tokens.UserAccessToken(userId), "buy-"+userId[:8], map[string]any{"packageId": packageId}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if started.Status != http.StatusCreated || started.Body["purchaseChannel"] != "web_checkout" {
		harness.T.Fatalf("start purchase: %d %s", started.Status, started.Raw)
	}
	if url, _ := started.Body["authorizationUrl"].(string); url == "" {
		harness.T.Fatalf("no hosted checkout url: %s", started.Raw)
	}
	harness.CompleteCheckoutThroughWebhook(started.Body["reference"].(string), 0, 2_000)
}

func TestWebCoinPurchaseCreditsOnceAndAppClientsMustUseInAppPurchase(t *testing.T) {
	harness := startWalletHarness(t, true)
	buyer := uuid.NewString()
	token := harness.Tokens.UserAccessToken(buyer)
	packages := harness.Call(http.MethodGet, "/api/v1/coins/packages", "", "", nil, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	first := packages.Body["data"].([]any)[0].(map[string]any)
	if first["id"] != "web-coins-1" || first["coins"].(float64) != 100 || first["price"].(map[string]any)["currency"] != "NGN" || first["price"].(map[string]any)["amountMinor"].(float64) != 100_000 {
		t.Fatalf("web packages: %v", packages.Body)
	}
	appPackages := harness.Call(http.MethodGet, "/api/v1/coins/packages", "", "", nil, http.Header{"X-Client-Platform": {"ios"}})
	if iosPack := appPackages.Body["data"].([]any)[0].(map[string]any); iosPack["purchaseChannel"] != "store_iap" || iosPack["clientPlatform"] != "ios" || iosPack["coins"].(float64) != 100 || iosPack["storeProductId"] != "com.nantty.app.coins.tier1" {
		t.Fatalf("app packages: %v", appPackages.Body)
	}
	if blocked := harness.Call(http.MethodPost, "/api/v1/coins/purchases", token, "app-web-key", map[string]any{"packageId": "web-coins-1"}, http.Header{"X-Client-Platform": {"android"}, "CloudFront-Viewer-Country": {"NG"}}); blocked.Status != http.StatusConflict {
		t.Fatalf("app client bought a web pack: %d", blocked.Status)
	}
	harness.buyCoinsOnTheWeb(buyer, "web-coins-3")
	verified := harness.Call(http.MethodPost, "/api/v1/coins/purchases/"+lastPurchaseReference(t, harness, buyer)+"/verify", token, "", nil)
	if verified.Body["status"] != "succeeded" || verified.Body["balance"].(float64) != 1030 {
		t.Fatalf("verify: %v", verified.Body)
	}
	if balance := harness.Call(http.MethodGet, "/api/v1/coins/balance", token, "", nil); balance.Body["coins"].(float64) != 1030 || balance.Body["earnedCoins"].(float64) != 0 {
		t.Fatalf("balance: %v", balance.Body)
	}
	if harness.balance(ledgermodels.CoinSalesRevenueAccount("NGN")) != 1_000_000 || harness.balance(ledgermodels.PaymentProcessingFeeExpenseAccount("NGN")) != 2_000 ||
		harness.balance(ledgermodels.PlatformProviderBalanceAccount("flutterwave", "NGN")) != harness.Flutterwave.MainBalanceOf("NGN") {
		t.Fatal("coin sale revenue, processing fee or platform balance not mirrored")
	}
	harness.AssertLedgerHealthy()
}

func lastPurchaseReference(t *testing.T, harness *walletHarness, userId string) string {
	var reference string
	schema := harness.wallet.Coins.Container.Settings.Money.DatabaseSchema
	if err := harness.Database.QueryRow(`SELECT reference FROM "`+schema+`".coin_purchases WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, userId).Scan(&reference); err != nil {
		t.Fatal(err)
	}
	return reference
}

func TestCoinTransfersTakeTwoPercentAndConcurrentTransfersNeverOverdraw(t *testing.T) {
	harness := startWalletHarness(t, true)
	sender, recipient := uuid.NewString(), uuid.NewString()
	harness.buyCoinsOnTheWeb(sender, "web-coins-1")
	token := harness.Tokens.UserAccessToken(sender)
	if quote := harness.Call(http.MethodGet, "/api/v1/coins/transfers/quote?coins=7", token, "", nil); quote.Body["feeCoins"].(float64) != 1 || quote.Body["netCoins"].(float64) != 6 {
		t.Fatalf("quote: %v", quote.Body)
	}
	if quote := harness.Call(http.MethodGet, "/api/v1/coins/transfers/quote?coins=40", token, "", nil); quote.Body["feePercent"].(float64) != 2 || quote.Body["feeBasisPoints"].(float64) != 200 {
		t.Fatalf("quote must expose exact configured fee: %v", quote.Body)
	}
	staleQuote := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "transfer-stale-quote", map[string]any{"recipientUserId": recipient, "coins": 40, "expectedFeeBasisPoints": 201})
	if staleQuote.Status != http.StatusConflict || staleQuote.Body["code"] != "COIN_TRANSFER_FEE_CHANGED" {
		t.Fatalf("stale transfer fee must require a new quote: %d %s", staleQuote.Status, staleQuote.Raw)
	}
	invalidQuote := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "transfer-invalid-quote", map[string]any{"recipientUserId": recipient, "coins": 40, "expectedFeeBasisPoints": -1})
	if invalidQuote.Status != http.StatusBadRequest {
		t.Fatalf("out-of-range expected fee must be rejected: %d %s", invalidQuote.Status, invalidQuote.Raw)
	}
	body := map[string]any{"recipientUserId": recipient, "coins": 40, "expectedFeeBasisPoints": 200}
	first := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "transfer-key-1", body)
	replay := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "transfer-key-1", body)
	reused := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "transfer-key-1", map[string]any{"recipientUserId": recipient, "coins": 41})
	if first.Status != http.StatusCreated || first.Body["netCoins"].(float64) != 39 || replay.Body["transferId"] != first.Body["transferId"] || reused.Status != http.StatusConflict {
		t.Fatalf("transfer idempotency: %v / %v / %d", first.Body, replay.Body, reused.Status)
	}
	if self := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "transfer-self-1", map[string]any{"recipientUserId": sender, "coins": 1}); self.Status != http.StatusUnprocessableEntity {
		t.Fatalf("self transfer: %d", self.Status)
	}
	var succeeded, refused atomic.Int64
	var group sync.WaitGroup
	for attempt := range 20 {
		group.Add(1)
		go func() {
			defer group.Done()
			response := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, fmt.Sprintf("concurrent-transfer-%02d", attempt), map[string]any{"recipientUserId": recipient, "coins": 6})
			switch response.Status {
			case http.StatusCreated:
				succeeded.Add(1)
			case http.StatusPaymentRequired:
				refused.Add(1)
			default:
				t.Errorf("unexpected %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	if succeeded.Load() != 10 || refused.Load() != 10 || harness.balance(ledgermodels.UserSpendableCoinsAccount(sender)) != 0 {
		t.Fatalf("succeeded=%d refused=%d balance=%d", succeeded.Load(), refused.Load(), harness.balance(ledgermodels.UserSpendableCoinsAccount(sender)))
	}
	if harness.balance(ledgermodels.UserSpendableCoinsAccount(recipient)) != 39+10*5 || harness.balance(ledgermodels.PlatformCoinTransferFeeRevenueAccount()) != 1+10 {
		t.Fatal("transfer split not booked as 98/2")
	}
	harness.AssertLedgerHealthy()
}

func TestInAppPurchaseBooksTheStoreFeeAndARefundClawsBackOrFlagsTheShortfall(t *testing.T) {
	harness := startWalletHarness(t, true)
	buyer := uuid.NewString()
	token := harness.Tokens.UserAccessToken(buyer)
	receipt := map[string]any{"platform": "ios", "productId": "com.nantty.app.coins.tier3", "receipt": "valid-receipt", "transactionId": "apple-txn-1"}
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
	if harness.balance(ledgermodels.UserSpendableCoinsAccount(buyer)) != 0 || harness.balance(ledgermodels.UserCoinDebtAccount(buyer)) != 0 {
		t.Fatal("clawback did not recover the remaining purchased coins without creating user debt")
	}
	if harness.balance(ledgermodels.PlatformUnrecoveredCoinClawbackAccount()) != 500 {
		t.Fatal("spent store coins were not recorded as platform clawback loss")
	}
	var flags int
	schema := harness.wallet.Coins.Container.Settings.Money.DatabaseSchema
	_ = harness.Database.QueryRow(`SELECT count(*) FROM "`+schema+`".wallet_risk_flags WHERE user_id = $1`, buyer).Scan(&flags)
	if flags != 1 {
		t.Fatalf("risk flags = %d", flags)
	}
	harness.AssertLedgerHealthy()
}
