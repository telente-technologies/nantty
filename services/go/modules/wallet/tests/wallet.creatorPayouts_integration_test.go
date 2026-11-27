package wallet_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	payoutservices "nantty/modules/wallet/src/modules/payouts/services"
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
	unapproved := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-unapproved", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if unapproved.Status != http.StatusForbidden || unapproved.Body["code"] != "CREATOR_PROGRAM_APPROVAL_REQUIRED" {
		t.Fatalf("account with seller/payout setup but no creator approval converted earnings: %d %s", unapproved.Status, unapproved.Raw)
	}
	if harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator)) != 180 {
		t.Fatal("unapproved user's earned coin balance changed")
	}
	harness.approveCreatorProgramMember(creator)
	if err := harness.wallet.Payouts.Holds.ApplyAccountHealthChange(context.Background(), payoutservices.AccountHealthChange{
		AccountId: creator, Status: "RESTRICTED", Restrictions: []string{"MONETISATION"}, CanMonetise: false, OccurredAt: time.Now().UTC(),
	}); err != nil {
		t.Fatal(err)
	}
	paused := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-paused", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if paused.Status != http.StatusForbidden || paused.Body["code"] != "CREATOR_MONETISATION_PAUSED" {
		t.Fatalf("restricted creator converted earnings: %d %s", paused.Status, paused.Raw)
	}
	if err := harness.wallet.Payouts.Holds.ApplyAccountHealthChange(context.Background(), payoutservices.AccountHealthChange{
		AccountId: creator, Status: "GOOD_STANDING", CanMonetise: true, OccurredAt: time.Now().UTC().Add(time.Second),
	}); err != nil {
		t.Fatal(err)
	}
	riskTable := pgx.Identifier{harness.wallet.Coins.Container.Settings.Money.DatabaseSchema, "wallet_risk_flags"}.Sanitize()
	if _, err := harness.Database.Exec("INSERT INTO "+riskTable+" (id, created_at, user_id, reason) VALUES ($1, $2, $3, $4)", uuid.New(), time.Now().UTC(), creator, "test_review"); err != nil {
		t.Fatal(err)
	}
	review := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-review", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if review.Status != http.StatusForbidden || review.Body["code"] != "CREATOR_MONETISATION_REVIEW_REQUIRED" {
		t.Fatalf("creator with open risk review converted earnings: %d %s", review.Status, review.Raw)
	}
	if harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator)) != 180 {
		t.Fatal("holds and risk review must not consume earned coins")
	}
	if _, err := harness.Database.Exec("UPDATE "+riskTable+" SET resolved_at = $1 WHERE user_id = $2", time.Now().UTC(), creator); err != nil {
		t.Fatal(err)
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

func TestScheduledCreatorPayoutRechecksCurrentCreatorProgramApproval(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	creator := uuid.NewString()
	token := harness.Tokens.UserAccessToken(creator)
	harness.OnboardConnectedAccount(creator, false)
	harness.approveCreatorProgramMember(creator)
	harness.creditEarnedCoins(creator, 180)
	converted := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-before-suspension", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if converted.Status != http.StatusCreated {
		t.Fatalf("approved member conversion: %d %s", converted.Status, converted.Raw)
	}
	creatorMembers := pgx.Identifier{harness.wallet.Coins.Container.Settings.CreatorsSchema, "creator_program_members"}.Sanitize()
	if _, err := harness.Database.Exec("UPDATE "+creatorMembers+" SET status = 'suspended' WHERE user_id = $1", creator); err != nil {
		t.Fatal(err)
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.process")
	run := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, staff.StepUp())
	if run.Status != http.StatusOK || run.Body["creatorTransfers"].(float64) != 0 {
		t.Fatalf("suspended creator payout should not be queued: %d %s", run.Status, run.Raw)
	}
	if payable := harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")); payable != 180_000 {
		t.Fatalf("suspended creator payable changed: %d", payable)
	}
}
