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
	return (harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals", token, key, map[string]any{"payoutAccountId": accountId, "amount": map[string]any{"amountMinor": amountMinor, "currency": "NGN"}}))
}

func TestCreatorEarningsAreTransferredFromThePlatformThenPaidOutOnlyWhenTheProviderConfirms(t *testing.T) {
	harness := startWalletHarness(t, true)
	creator := uuid.NewString()
	token := harness.Tokens.UserAccessToken(creator)
	harness.creditEarnedCoins(creator, 180)
	converted := harness.Call(http.MethodPost, "/api/v1/creators/earnings/convert", token, "convert-key-1", map[string]any{"coins": 180, "currency": "NGN"})
	if converted.Status != http.StatusCreated || converted.Body["cash"].(map[string]any)["amountMinor"].(float64) != 180_000 {
		t.Fatalf("convert: %d %s", converted.Status, converted.Raw)
	}
	if harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")) != 180_000 || harness.balance(ledgermodels.SellerAvailableAccount(creator, "NGN")) != 0 {
		t.Fatal("converted coins must stay a platform payable until transferred")
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.withdrawals.process")
	stepUp := http.Header{"X-Step-Up-Token": {staff.StepUpToken}}
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp); report.Body["creatorTransfers"].(float64) != 0 {
		t.Fatalf("transferred to a creator without a connected account: %v", report.Body)
	}
	connectedAccountId := harness.OnboardConnectedAccount(creator, false)
	harness.Bachs.FundPlatformBalance("NGN", 1_000_000)
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp); report.Body["creatorTransfers"].(float64) != 1 {
		t.Fatalf("creator transfer: %v", report.Body)
	}
	if harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")) != 0 || harness.balance(ledgermodels.SellerAvailableAccount(creator, "NGN")) != 180_000 ||
		harness.Bachs.BalanceOf(connectedAccountId, "NGN") != 180_000 {
		t.Fatal("creator share not moved into the creator's own provider account")
	}
	if invalid := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "", map[string]any{"bankCode": "058", "accountNumber": "0001234567"}); invalid.Status != http.StatusUnprocessableEntity {
		t.Fatalf("unresolvable account accepted: %d %s", invalid.Status, invalid.Raw)
	}
	account := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "", map[string]any{"bankCode": "058", "accountNumber": "0123454821"})
	if account.Status != http.StatusCreated || account.Body["accountName"] != "TEMITOPE ADEYEMI" {
		t.Fatalf("payout account: %d %s", account.Status, account.Raw)
	}
	accountId := account.Body["id"].(string)
	quote := harness.Call(http.MethodGet, "/api/v1/wallets/me/withdrawals/quote?payoutAccountId="+accountId+"&amountMinor=100000&currency=NGN", token, "", nil)
	if quote.Body["fee"].(map[string]any)["amountMinor"].(float64) != 5_000 || quote.Body["netAmount"].(map[string]any)["amountMinor"].(float64) != 95_000 {
		t.Fatalf("quote: %v", quote.Body)
	}
	if over := harness.withdraw(token, "withdraw-over", accountId, 180_001); over.Status != http.StatusUnprocessableEntity {
		t.Fatalf("overdraw accepted: %d", over.Status)
	}
	first := harness.withdraw(token, "withdraw-key-1", accountId, 100_000)
	second := harness.withdraw(token, "withdraw-key-2", accountId, 50_000)
	if first.Status != http.StatusCreated || second.Status != http.StatusCreated {
		t.Fatalf("withdrawals: %d %s / %d %s", first.Status, first.Raw, second.Status, second.Raw)
	}
	if beyondProvider := harness.withdraw(token, "withdraw-key-beyond", accountId, 30_001); beyondProvider.Status != http.StatusUnprocessableEntity {
		t.Fatalf("queued withdrawals were not subtracted from the provider balance: %d", beyondProvider.Status)
	}
	harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals/"+second.Body["id"].(string)+"/cancel", token, "", nil)
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp); report.Body["started"].(float64) != 0 {
		t.Fatalf("an unreviewed withdrawal was paid: %v", report.Body)
	}
	harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+first.Body["id"].(string)+"/review", staff.AccessToken, "review-key-1", map[string]any{"decision": "approve"}, stepUp)
	if report := harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp); report.Body["processing"].(float64) != 1 || harness.Bachs.Calls("POST /v1/payouts") != 1 {
		t.Fatalf("payout run: %v", report.Body)
	}
	if harness.balance(ledgermodels.SellerReservedPayoutAccount(creator, "NGN")) != 100_000 {
		t.Fatal("a payout was booked as paid before the provider confirmed it")
	}
	harness.AssertProviderMirrorMatches()
	firstReference := first.Body["reference"].(string)
	payout := harness.Bachs.SetPayoutStatus(firstReference, "completed")
	harness.DeliverBachsEvent("payout.paid", connectedAccountId, map[string]any{"withdrawal_id": payout.Id, "reference": firstReference, "status": "completed", "amount": "950.00", "currency": "NGN"})
	if harness.balance(ledgermodels.SellerReservedPayoutAccount(creator, "NGN")) != 0 || harness.balance(ledgermodels.SellerAvailableAccount(creator, "NGN")) != 80_000 ||
		harness.balance(ledgermodels.SellerProviderHeldFundsAccount(creator, "NGN")) != 80_000 {
		t.Fatal("payout not booked from reserved payout out of the provider-held mirror")
	}
	third := harness.withdraw(token, "withdraw-key-3", accountId, 80_000)
	harness.Call(http.MethodPost, "/api/v1/admin/withdrawals/"+third.Body["id"].(string)+"/review", staff.AccessToken, "review-key-3", map[string]any{"decision": "approve"}, stepUp)
	harness.Call(http.MethodPost, "/api/v1/admin/payouts/run", staff.AccessToken, "", nil, stepUp)
	failed := harness.Bachs.SetPayoutStatus(third.Body["reference"].(string), "failed")
	harness.DeliverBachsEvent("payout.failed", connectedAccountId, map[string]any{"withdrawal_id": failed.Id, "reference": third.Body["reference"], "status": "failed"})
	if harness.balance(ledgermodels.SellerAvailableAccount(creator, "NGN")) != 80_000 {
		t.Fatal("a failed payout did not return the money to available")
	}
	harness.AssertProviderMirrorMatches()
	harness.AssertLedgerHealthy()
}
