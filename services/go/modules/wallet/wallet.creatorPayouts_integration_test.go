package wallet

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
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
	converted := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-key-1", map[string]any{"coins": 180, "currency": "NGN"}, http.Header{"CloudFront-Viewer-Country": {"NG"}})
	if converted.Status != http.StatusCreated || converted.Body["cash"].(map[string]any)["amountMinor"].(float64) != 180_000 {
		t.Fatalf("convert: %d %s", converted.Status, converted.Raw)
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.process")
	stepUp := staff.StepUp
	harness.Paystack.FundPlatformBalance("NGN", 175_000)
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp()); report.Body["creatorTransfers"].(float64) != 1 {
		t.Fatalf("creator earnings: %v", report.Body)
	}
	if harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")) != 0 || harness.balance(ledgermodels.SellerAvailableAccount(creator, "NGN")) != 180_000 {
		t.Fatal("creator share not made withdrawable")
	}
	account := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "", map[string]any{"bankCode": "058", "accountNumber": "0123454821"}, harness.stepUp(token))
	if account.Status != http.StatusCreated || account.Body["accountName"] != "TEMITOPE ADEYEMI" {
		t.Fatalf("payout account: %d %s", account.Status, account.Raw)
	}
	accountId := account.Body["id"].(string)
	quote := harness.Call(http.MethodGet, "/api/v1/wallets/me/withdrawals/quote?payoutAccountId="+accountId+"&amountMinor=100000&currency=NGN", token, "", nil)
	if quote.Body["fee"].(map[string]any)["amountMinor"].(float64) != 1_000 || quote.Body["netAmount"].(map[string]any)["amountMinor"].(float64) != 99_000 {
		t.Fatalf("quote must use the Paystack transfer fee band: %v", quote.Body)
	}
	first := harness.withdraw(token, "withdraw-key-1", accountId, 100_000)
	second := harness.withdraw(token, "withdraw-key-2", accountId, 50_000)
	if first.Status != http.StatusCreated || second.Status != http.StatusCreated {
		t.Fatalf("withdrawals: %d %s / %d %s", first.Status, first.Raw, second.Status, second.Raw)
	}
	if beyondProvider := harness.withdraw(token, "withdraw-key-beyond", accountId, 30_000); beyondProvider.Status != http.StatusUnprocessableEntity {
		t.Fatalf("queued withdrawals were not subtracted from the Paystack balance: %d", beyondProvider.Status)
	}
	harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals/"+second.Body["id"].(string)+"/cancel", token, "", nil)
	harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+first.Body["id"].(string)+"/review", staff.AccessToken, "review-key-1", map[string]any{"decision": "approve"}, stepUp())
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp()); report.Body["processing"].(float64) != 1 || harness.Paystack.Calls("POST /transfer") != 1 {
		t.Fatalf("payout run: %v", report.Body)
	}
	if harness.balance(ledgermodels.SellerReservedPayoutAccount(creator, "NGN")) != 100_000 {
		t.Fatal("a payout was booked as paid before Paystack confirmed it")
	}
	firstReference := first.Body["reference"].(string)
	transfer := harness.Paystack.SetTransferStatus(firstReference, "success")
	harness.DeliverPaystackEvent("transfer.success", map[string]any{"reference": firstReference, "transfer_code": transfer.Code, "status": "success", "amount": transfer.AmountMinor})
	if harness.balance(ledgermodels.SellerReservedPayoutAccount(creator, "NGN")) != 0 || harness.balance(ledgermodels.SellerAvailableAccount(creator, "NGN")) != 80_000 {
		t.Fatal("payout not booked from reserved payout")
	}
	third := harness.withdraw(token, "withdraw-key-3", accountId, 60_000)
	harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+third.Body["id"].(string)+"/review", staff.AccessToken, "review-key-3", map[string]any{"decision": "approve"}, stepUp())
	harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp())
	failed := harness.Paystack.SetTransferStatus(third.Body["reference"].(string), "failed")
	harness.DeliverPaystackEvent("transfer.failed", map[string]any{"reference": third.Body["reference"], "transfer_code": failed.Code, "status": "failed"})
	if harness.balance(ledgermodels.SellerAvailableAccount(creator, "NGN")) != 80_000 {
		t.Fatal("a failed transfer did not return the money to available")
	}
	harness.AssertLedgerHealthy()
}
