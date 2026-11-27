package wallet_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/wallet/src/configs"
)

func (harness *walletHarness) creditEarnedCoins(userId string, coins int64) {
	harness.post(ledgermodels.JournalEntryRequest{Reference: "seed-earned-" + userId, Kind: "test.giftEarnings", Lines: []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Debit, AmountMinor: coins},
		{Account: ledgermodels.CreatorEarnedCoinsAccount(userId), Direction: ledgermodels.Credit, AmountMinor: coins},
	}})
}

func (harness *walletHarness) withdraw(token, key, accountId string, amountMinor int64) paymentstesting.HarnessResponse {
	return harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals", token, key, map[string]any{"payoutAccountId": accountId, "amount": map[string]any{"amountMinor": amountMinor, "currency": "NGN"}}, harness.stepUp(token))
}

func (harness *walletHarness) stepUp(accessToken string) http.Header {
	return harness.StepUpFor(accessToken)
}

func TestCreatorEarningsBecomeWithdrawableAfterVerificationAndArePaidByTransfer(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	creator := uuid.NewString()
	token := harness.Tokens.UserAccessToken(creator)
	harness.creditEarnedCoins(creator, 180)
	if refused := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-key-0", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}}); refused.Status != http.StatusForbidden || refused.Body["code"] != "VERIFICATION_REQUIRED" {
		t.Fatalf("an unverified creator converted coins to cash: %d %s", refused.Status, refused.Raw)
	}
	if harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator)) != 180 {
		t.Fatal("an unverified creator's earned coins must stay as coins")
	}
	harness.OnboardConnectedAccount(creator, false)
	staleQuote := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-quote-stale", map[string]any{"coins": 180, "currency": "NGN", "expectedCashMinor": 179_000}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if staleQuote.Status != http.StatusConflict || staleQuote.Body["code"] != "CONVERSION_RATE_CHANGED" {
		t.Fatalf("a mismatched expectedCashMinor quote must fail closed: %d %s", staleQuote.Status, staleQuote.Raw)
	}
	if message, _ := staleQuote.Body["message"].(string); message == "" || message != "The coin conversion payout is now 1800.00 NGN. Review the updated payout and try again." {
		t.Fatalf("stale quote response must show a human-readable major-unit payout: %q", message)
	}
	converted := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-key-1", map[string]any{"coins": 180, "currency": "NGN", "expectedCashMinor": 180_000}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if converted.Status != http.StatusCreated || converted.Body["cash"].(map[string]any)["amountMinor"].(float64) != 180_000 {
		t.Fatalf("convert: %d %s", converted.Status, converted.Raw)
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.process")
	stepUp := staff.StepUp
	harness.Flutterwave.FundMainBalance("NGN", 1_000_000)
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp()); report.Body["creatorTransfers"].(float64) != 1 {
		t.Fatalf("creator earnings: %v", report.Body)
	}
	harness.RunMoneyWorkers()
	if harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")) != 0 || harness.balance(ledgermodels.WalletAvailableAccount(creator, "NGN")) != 180_000 {
		t.Fatalf("creator share not made withdrawable: %v", harness.NonZeroBalances())
	}
	account := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "", map[string]any{"bankCode": "058", "accountNumber": "0123454821"}, harness.stepUp(token))
	if account.Status != http.StatusCreated || account.Body["accountName"] != "TEMITOPE ADEYEMI" {
		t.Fatalf("payout account: %d %s", account.Status, account.Raw)
	}
	accountId := account.Body["id"].(string)
	quote := harness.Call(http.MethodGet, "/api/v1/wallets/me/withdrawals/quote?payoutAccountId="+accountId+"&amountMinor=100000&currency=NGN", token, "", nil)
	if quote.Body["fee"].(map[string]any)["amountMinor"].(float64) != 1_075 || quote.Body["netAmount"].(map[string]any)["amountMinor"].(float64) != 98_925 {
		t.Fatalf("quote must use the provider transfer fee: %v", quote.Body)
	}
	first := harness.withdraw(token, "withdraw-key-1", accountId, 100_000)
	second := harness.withdraw(token, "withdraw-key-2", accountId, 50_000)
	if first.Status != http.StatusCreated || second.Status != http.StatusCreated {
		t.Fatalf("withdrawals: %d %s / %d %s", first.Status, first.Raw, second.Status, second.Raw)
	}
	if beyondProvider := harness.withdraw(token, "withdraw-key-beyond", accountId, 30_001); beyondProvider.Status != http.StatusUnprocessableEntity {
		t.Fatalf("queued withdrawals were not subtracted from the wallet balance: %d", beyondProvider.Status)
	}
	harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals/"+second.Body["id"].(string)+"/cancel", token, "", nil)
	harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+first.Body["id"].(string)+"/review", staff.AccessToken, "review-key-1", map[string]any{"decision": "approve"}, stepUp())
	transfersBefore := harness.Flutterwave.Calls("POST /transfers")
	report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp())
	harness.RunMoneyWorkers()
	if report.Body["processing"].(float64) != 1 || harness.Flutterwave.Calls("POST /transfers")-transfersBefore != 1 {
		t.Fatalf("payout run: %v", report.Body)
	}
	if harness.balance(ledgermodels.WalletReservedPayoutAccount(creator, "NGN")) != 100_000 {
		t.Fatal("a payout was booked as paid before the provider confirmed it")
	}
	firstReference := first.Body["reference"].(string)
	harness.FinishTransfer(firstReference, true)
	if harness.balance(ledgermodels.WalletReservedPayoutAccount(creator, "NGN")) != 0 || harness.balance(ledgermodels.WalletAvailableAccount(creator, "NGN")) != 80_000 {
		t.Fatalf("payout not booked from reserved payout: %v", harness.NonZeroBalances())
	}
	third := harness.withdraw(token, "withdraw-key-3", accountId, 60_000)
	harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+third.Body["id"].(string)+"/review", staff.AccessToken, "review-key-3", map[string]any{"decision": "approve"}, stepUp())
	harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp())
	harness.RunMoneyWorkers()
	harness.FinishTransfer(third.Body["reference"].(string), false)
	if harness.balance(ledgermodels.WalletAvailableAccount(creator, "NGN")) != 80_000 {
		t.Fatal("a failed transfer did not return the money to available")
	}
	harness.AssertLedgerHealthy()
}

func TestCreatorConversionKeepsEarnedCoinsUntilTheTwentyThousandNairaMinimumIsMet(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true, func(settings *configs.WalletSettings) {
		settings.MinimumPayoutMinorByCurrency["NGN"] = 2_000_000
	})
	creator := uuid.NewString()
	token := harness.Tokens.UserAccessToken(creator)
	harness.creditEarnedCoins(creator, 2_000)
	harness.OnboardConnectedAccount(creator, false)

	below := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-below-minimum", map[string]any{"coins": 1_999, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if below.Status != http.StatusUnprocessableEntity || below.Body["code"] != "BELOW_MINIMUM_PAYOUT" {
		t.Fatalf("₦19,990 must not pass the ₦20,000 minimum: %d %s", below.Status, below.Raw)
	}
	if balance := harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator)); balance != 2_000 {
		t.Fatalf("a rejected conversion must preserve all earned coins, balance=%d", balance)
	}

	atMinimum := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-at-minimum", map[string]any{"coins": 2_000, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if atMinimum.Status != http.StatusCreated || atMinimum.Body["cash"].(map[string]any)["amountMinor"].(float64) != 2_000_000 || atMinimum.Body["minimumPayout"].(map[string]any)["amountMinor"].(float64) != 2_000_000 {
		t.Fatalf("exactly ₦20,000 must be convertible and disclosed: %d %s", atMinimum.Status, atMinimum.Raw)
	}
	if balance := harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator)); balance != 0 {
		t.Fatalf("the successful exact-boundary conversion must debit earned coins once, balance=%d", balance)
	}
}

func TestCreatorConversionFailsClosedWhenCurrencyMinimumIsUnconfigured(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true, func(settings *configs.WalletSettings) {
		settings.MinimumPayoutMinorByCurrency = map[string]int64{"USD": 1_000}
	})
	creator := uuid.NewString()
	token := harness.Tokens.UserAccessToken(creator)
	harness.creditEarnedCoins(creator, 2_000)
	harness.OnboardConnectedAccount(creator, false)

	response := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-unconfigured-minimum", map[string]any{"coins": 2_000, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if response.Status != http.StatusServiceUnavailable || response.Body["code"] != "PAYOUT_MINIMUM_UNCONFIGURED" {
		t.Fatalf("conversion without an explicit currency minimum must fail closed: %d %s", response.Status, response.Raw)
	}
	if balance := harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator)); balance != 2_000 {
		t.Fatalf("unconfigured minimum must not move earned coins, balance=%d", balance)
	}
}
