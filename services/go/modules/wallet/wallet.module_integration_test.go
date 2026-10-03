package wallet

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/wallet/src"
	"zudomart/modules/wallet/src/configs"
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
	wallet *src.Module
}

func startWalletHarness(t *testing.T, requireReview bool) *walletHarness {
	t.Helper()
	money := paymentstesting.StartMoneyHarnessWithPayments(t, map[string]interfaces.StoreReceiptVerifier{"apple_iap": fakeStoreVerifier{store: "apple_iap"}})
	settings := configs.WalletSettings{
		Money:                        moneytesting.MoneyModuleSettingsForTests("wallet", moneytesting.CreateEmptySchema(t, money.Database, "wallet"), money.LedgerSchema),
		CoinTransferFeeBps:           2500,
		CoinCashValueMinorByCurrency: configs.ParseCurrencyAmounts("NGN:1000,USD:1"),
		MinimumPayoutMinorByCurrency: configs.ParseCurrencyAmounts("NGN:1000,USD:1000"),
		MinimumWithdrawalMinor:       100, DataEncryptionKey: bytes.Repeat([]byte{9}, 32), DefaultPayoutProvider: "paystack",
		DefaultCurrency: "NGN", WithdrawalsRequireReview: requireReview, PayoutRunInterval: time.Hour,
	}
	money.Payments.Application.Container.Settings.DefaultProvider = "paystack"
	module, err := src.StartWalletModuleWithSettings(context.Background(), settings, money.Dependencies, money.Overrides(), money.Payments.Application.Gateway)
	if err != nil {
		t.Fatal(err)
	}
	money.MountModule(module)
	return &walletHarness{MoneyHarness: money, wallet: module}
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
	started := harness.Call(http.MethodPost, "/api/v1/coins/purchases", harness.Tokens.UserAccessToken(userId), "buy-"+userId[:8], map[string]any{"packageId": packageId}, http.Header{"X-Client-Region": {"NG"}})
	if started.Status != http.StatusCreated || started.Body["purchaseChannel"] != "web_checkout" {
		harness.T.Fatalf("start purchase: %d %s", started.Status, started.Raw)
	}
	reference := started.Body["reference"].(string)
	harness.Paystack.MarkChargeAs(reference, "success", 0, 0)
	body, headers := paymentstesting.SignedPaystackWebhook("charge.success", map[string]any{"id": harness.Paystack.ChargeId(reference), "reference": reference})
	if response := harness.Call(http.MethodPost, "/api/v1/payments/webhooks/paystack", "", "", body, headers); response.Status != http.StatusOK {
		harness.T.Fatalf("webhook: %d %s", response.Status, response.Raw)
	}
}

func TestWebCoinPurchaseCreditsOnceAndAppClientsMustUseInAppPurchase(t *testing.T) {
	harness := startWalletHarness(t, true)
	buyer := uuid.NewString()
	token := harness.Tokens.UserAccessToken(buyer)
	packages := harness.Call(http.MethodGet, "/api/v1/coins/packages", "", "", nil, http.Header{"X-Client-Region": {"NG"}})
	first := packages.Body["data"].([]any)[0].(map[string]any)
	if first["id"] != "coins-70" || first["price"].(map[string]any)["currency"] != "NGN" || first["price"].(map[string]any)["amountMinor"].(float64) != 150_000 {
		t.Fatalf("web packages: %v", packages.Body)
	}
	appPackages := harness.Call(http.MethodGet, "/api/v1/coins/packages", "", "", nil, http.Header{"X-Client-Platform": {"ios"}})
	if appPackages.Body["data"].([]any)[0].(map[string]any)["purchaseChannel"] != "store_iap" {
		t.Fatalf("app packages: %v", appPackages.Body)
	}
	if blocked := harness.Call(http.MethodPost, "/api/v1/coins/purchases", token, "app-web-key", map[string]any{"packageId": "coins-70"}, http.Header{"X-Client-Platform": {"android"}}); blocked.Status != http.StatusConflict {
		t.Fatalf("app client bought a web pack: %d", blocked.Status)
	}
	harness.buyCoinsOnTheWeb(buyer, "coins-700")
	verified := harness.Call(http.MethodPost, "/api/v1/coins/purchases/"+lastPurchaseReference(t, harness, buyer)+"/verify", token, "", nil)
	if verified.Body["status"] != "succeeded" || verified.Body["balance"].(float64) != 735 {
		t.Fatalf("verify: %v", verified.Body)
	}
	if balance := harness.Call(http.MethodGet, "/api/v1/coins/balance", token, "", nil); balance.Body["coins"].(float64) != 735 || balance.Body["earnedCoins"].(float64) != 0 {
		t.Fatalf("balance: %v", balance.Body)
	}
	if harness.balance(ledgermodels.CoinSalesRevenueAccount("NGN")) != 1_500_000 {
		t.Fatal("coin sale revenue not booked")
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

func TestCoinTransfersTakeTwentyFivePercentAndConcurrentTransfersNeverOverdraw(t *testing.T) {
	harness := startWalletHarness(t, true)
	sender, recipient := uuid.NewString(), uuid.NewString()
	harness.buyCoinsOnTheWeb(sender, "coins-70")
	token := harness.Tokens.UserAccessToken(sender)
	if quote := harness.Call(http.MethodGet, "/api/v1/coins/transfers/quote?coins=7", token, "", nil); quote.Body["feeCoins"].(float64) != 2 || quote.Body["netCoins"].(float64) != 5 {
		t.Fatalf("quote: %v", quote.Body)
	}
	body := map[string]any{"recipientUserId": recipient, "coins": 10}
	first := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "transfer-key-1", body)
	replay := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "transfer-key-1", body)
	reused := harness.Call(http.MethodPost, "/api/v1/coins/transfers", token, "transfer-key-1", map[string]any{"recipientUserId": recipient, "coins": 11})
	if first.Status != http.StatusCreated || first.Body["netCoins"].(float64) != 7 || replay.Body["transferId"] != first.Body["transferId"] || reused.Status != http.StatusConflict {
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
	if harness.balance(ledgermodels.UserSpendableCoinsAccount(recipient)) != 7+10*4 || harness.balance(ledgermodels.PlatformCoinTransferFeeRevenueAccount()) != 3+10*2 {
		t.Fatal("transfer split not booked as 75/25")
	}
	harness.AssertLedgerHealthy()
}

func TestInAppPurchaseBooksTheStoreFeeAndARefundClawsBackOrFlagsTheShortfall(t *testing.T) {
	harness := startWalletHarness(t, true)
	buyer := uuid.NewString()
	token := harness.Tokens.UserAccessToken(buyer)
	receipt := map[string]any{"platform": "ios", "productId": "zudomart.coins.600", "receipt": "valid-receipt", "transactionId": "apple-txn-1"}
	redeemed := harness.Call(http.MethodPost, "/api/v1/coins/iap/receipts", token, "iap-key-1", receipt)
	if redeemed.Status != http.StatusCreated || redeemed.Body["balance"].(float64) != 630 {
		t.Fatalf("redeem: %d %s", redeemed.Status, redeemed.Raw)
	}
	if again := harness.Call(http.MethodPost, "/api/v1/coins/iap/receipts", token, "iap-key-2", receipt); again.Body["balance"].(float64) != 630 {
		t.Fatalf("receipt redeemed twice: %v", again.Body)
	}
	if stolen := harness.Call(http.MethodPost, "/api/v1/coins/iap/receipts", harness.Tokens.UserAccessToken(uuid.NewString()), "iap-key-3", receipt); stolen.Status != http.StatusConflict {
		t.Fatalf("another account redeemed the receipt: %d", stolen.Status)
	}
	if harness.balance(ledgermodels.AppStoreFeeExpenseAccount("apple_iap", "USD")) != 300 || harness.balance(ledgermodels.ProviderClearingAccount("apple_iap", "USD")) != 699 {
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

func (harness *walletHarness) creditEarnedCoins(userId string, coins int64) {
	harness.post(ledgermodels.JournalEntryRequest{Reference: "seed-earned-" + userId, Kind: "test.giftEarnings", Lines: []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Debit, AmountMinor: coins},
		{Account: ledgermodels.CreatorEarnedCoinsAccount(userId), Direction: ledgermodels.Credit, AmountMinor: coins},
	}})
}

func TestEarnedCoinsBecomeCashAndOnlyAvailableMoneyIsPaidOutThroughTheDailyRun(t *testing.T) {
	harness := startWalletHarness(t, true)
	creator := uuid.NewString()
	token := harness.Tokens.UserAccessToken(creator)
	harness.creditEarnedCoins(creator, 180)
	if tooSmall := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-small", map[string]any{"coins": 0}); tooSmall.Status != http.StatusBadRequest {
		t.Fatalf("zero coins accepted: %d", tooSmall.Status)
	}
	if tooMany := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-many", map[string]any{"coins": 181, "currency": "NGN"}); tooMany.Status != http.StatusUnprocessableEntity {
		t.Fatalf("converted more than earned: %d", tooMany.Status)
	}
	converted := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-key-1", map[string]any{"coins": 180, "currency": "NGN"})
	if converted.Status != http.StatusCreated || converted.Body["cash"].(map[string]any)["amountMinor"].(float64) != 180_000 || converted.Body["earnedCoinsRemaining"].(float64) != 0 {
		t.Fatalf("convert: %d %s", converted.Status, converted.Raw)
	}
	if invalid := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "", map[string]any{"bankCode": "058", "accountNumber": "0001234567"}); invalid.Status != http.StatusUnprocessableEntity {
		t.Fatalf("unresolvable account accepted: %d %s", invalid.Status, invalid.Raw)
	}
	account := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "", map[string]any{"bankCode": "058", "accountNumber": "0123454821"})
	if account.Status != http.StatusCreated || account.Body["accountNumberMasked"] != "••••4821" || account.Body["accountName"] != "TEMITOPE ADEYEMI" {
		t.Fatalf("payout account: %d %s", account.Status, account.Raw)
	}
	accountId := account.Body["id"].(string)
	quote := harness.Call(http.MethodGet, "/api/v1/wallets/me/withdrawals/quote?payoutAccountId="+accountId+"&amountMinor=100000&currency=NGN", token, "", nil)
	if quote.Body["fee"].(map[string]any)["amountMinor"].(float64) != 1_000 || quote.Body["netAmount"].(map[string]any)["amountMinor"].(float64) != 99_000 {
		t.Fatalf("quote: %v", quote.Body)
	}
	if over := harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals", token, "withdraw-over", map[string]any{"payoutAccountId": accountId, "amount": map[string]any{"amountMinor": 180_001, "currency": "NGN"}}); over.Status != http.StatusUnprocessableEntity {
		t.Fatalf("overdraw accepted: %d", over.Status)
	}
	first := harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals", token, "withdraw-key-1", map[string]any{"payoutAccountId": accountId, "amount": map[string]any{"amountMinor": 100_000, "currency": "NGN"}})
	second := harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals", token, "withdraw-key-2", map[string]any{"payoutAccountId": accountId, "amount": map[string]any{"amountMinor": 50_000, "currency": "NGN"}})
	if first.Status != http.StatusCreated || first.Body["status"] != "pending" || second.Status != http.StatusCreated {
		t.Fatalf("withdrawals: %d %s / %d", first.Status, first.Raw, second.Status)
	}
	summary := harness.Call(http.MethodGet, "/api/v1/wallets/me", token, "", nil, http.Header{"X-Client-Region": {"NG"}})
	if summary.Body["available"].(map[string]any)["amountMinor"].(float64) != 30_000 || summary.Body["payoutRequested"].(map[string]any)["amountMinor"].(float64) != 150_000 {
		t.Fatalf("summary: %v", summary.Body)
	}
	if cancelled := harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals/"+second.Body["id"].(string)+"/cancel", token, "", nil); cancelled.Body["withdrawalStatus"] != "cancelled" {
		t.Fatalf("cancel: %v", cancelled.Body)
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.process")
	stepUp := http.Header{"X-Step-Up-Token": {staff.StepUpToken}}
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp); report.Body["started"].(float64) != 0 {
		t.Fatalf("an unreviewed withdrawal was paid: %v", report.Body)
	}
	approved := harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+first.Body["id"].(string)+"/review", staff.AccessToken, "review-key-1", map[string]any{"decision": "approve"}, stepUp)
	if approved.Body["withdrawalStatus"] != "queued" {
		t.Fatalf("review: %d %s", approved.Status, approved.Raw)
	}
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp); report.Body["paid"].(float64) != 1 || harness.Paystack.TransferCalls != 1 {
		t.Fatalf("payout run: %v (transfers %d)", report.Body, harness.Paystack.TransferCalls)
	}
	if harness.balance(ledgermodels.SellerReservedPayoutAccount(creator, "NGN")) != 0 || harness.balance(ledgermodels.SellerAvailableAccount(creator, "NGN")) != 80_000 || harness.balance(ledgermodels.ProviderClearingAccount("paystack", "NGN")) != -100_000 {
		t.Fatal("payout not booked from reserved payout to clearing")
	}
	harness.Paystack.TransferOutcome = "failed"
	third := harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals", token, "withdraw-key-3", map[string]any{"payoutAccountId": accountId, "amount": map[string]any{"amountMinor": 80_000, "currency": "NGN"}})
	harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+third.Body["id"].(string)+"/review", staff.AccessToken, "review-key-3", map[string]any{"decision": "approve"}, stepUp)
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp); report.Body["failed"].(float64) != 1 {
		t.Fatalf("failed payout run: %v", report.Body)
	}
	if harness.balance(ledgermodels.SellerAvailableAccount(creator, "NGN")) != 80_000 {
		t.Fatal("a failed payout did not return the money to available")
	}
	transactions := harness.Call(http.MethodGet, "/api/v1/wallets/me/transactions", token, "", nil, http.Header{"X-Client-Region": {"NG"}})
	if len(transactions.Body["data"].([]any)) < 4 {
		t.Fatalf("transactions: %v", transactions.Body)
	}
	harness.AssertLedgerHealthy()
}
