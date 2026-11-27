package wallet_test

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
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
	harness.approveCreator(creator)
	harness.creditEarnedCoins(creator, 180)
	if refused := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-key-0", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}}); refused.Status != http.StatusForbidden || refused.Body["code"] != "VERIFICATION_REQUIRED" {
		t.Fatalf("an unverified creator converted coins to cash: %d %s", refused.Status, refused.Raw)
	}
	if harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator)) != 180 {
		t.Fatal("an unverified creator's earned coins must stay as coins")
	}
	harness.OnboardConnectedAccount(creator, false)
	harness.setCreatorStatus(creator, "pending")
	if refused := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-not-approved", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}}); refused.Status != http.StatusForbidden || refused.Body["code"] != "CREATOR_PROGRAM_REQUIRED" {
		t.Fatalf("a payout-verified account outside the Creator Program converted coins: %d %s", refused.Status, refused.Raw)
	}
	harness.setCreatorStatus(creator, "approved")
	nonCreator := uuid.NewString()
	harness.OnboardConnectedAccount(nonCreator, false)
	harness.creditEarnedCoins(nonCreator, 180)
	denied := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", harness.Tokens.UserAccessToken(nonCreator), "convert-noncreator", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if denied.Status != http.StatusForbidden || denied.Body["code"] != "CREATOR_PROGRAM_REQUIRED" || harness.balance(ledgermodels.CreatorEarnedCoinsAccount(nonCreator)) != 180 {
		t.Fatalf("a payout-verified seller without Creator Program approval must not convert earned coins: %d %s", denied.Status, denied.Raw)
	}
	suspendedCreator := uuid.NewString()
	harness.setCreatorStatus(suspendedCreator, "approved")
	harness.suspendCreator(suspendedCreator)
	harness.OnboardConnectedAccount(suspendedCreator, false)
	harness.creditEarnedCoins(suspendedCreator, 180)
	suspended := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", harness.Tokens.UserAccessToken(suspendedCreator), "convert-suspended", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if suspended.Status != http.StatusForbidden || suspended.Body["code"] != "CREATOR_PROGRAM_REQUIRED" || harness.balance(ledgermodels.CreatorEarnedCoinsAccount(suspendedCreator)) != 180 {
		t.Fatalf("a payout-verified suspended creator must not convert earned coins: %d %s", suspended.Status, suspended.Raw)
	}
	harness.post(ledgermodels.JournalEntryRequest{Reference: "seed-noncreator-payable", Kind: "test.noncreatorPayable", Lines: []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.CreatorCoinPayoutExpenseAccount("NGN"), Direction: ledgermodels.Debit, AmountMinor: 180_000},
		{Account: ledgermodels.CreatorEarningsPayableAccount(nonCreator, "NGN"), Direction: ledgermodels.Credit, AmountMinor: 180_000},
	}})
	if report := harness.wallet.Payouts.Creators.TransferCreatorEarningsToConnectedAccounts(t.Context(), "seller-without-creator-program"); report.Transferred != 0 || harness.balance(ledgermodels.CreatorEarningsPayableAccount(nonCreator, "NGN")) != 180_000 {
		t.Fatalf("scheduled earnings sweep must keep non-creator payables untouched: %+v", report)
	}
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
	harness.suspendCreator(creator)
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp()); report.Body["creatorTransfers"].(float64) != 0 || harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")) != 180_000 {
		t.Fatalf("suspended Creator Program member must not be paid: %v", report.Body)
	}
	harness.setCreatorStatus(creator, "approved")
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
