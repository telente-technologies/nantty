package paymentstesting

import (
	"database/sql"

	"context"
	"fmt"
	"hash/fnv"
	"net/http"
	"time"
	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"

	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/payments/src/modules/gateway/services"
)

func (harness *MoneyHarness) SetCountry(userId, country string) {
	harness.T.Helper()
	if _, err := harness.Database.Exec(`INSERT INTO "`+harness.UsersSchema+`".profiles (account_id, kind, country_code) SELECT $1::uuid, 'personal', $2 WHERE NOT EXISTS (SELECT 1 FROM "`+harness.UsersSchema+`".profiles WHERE account_id = $1::uuid)`, userId, country); err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *MoneyHarness) OnboardConnectedAccount(userId string, acceptPayments bool) string {
	harness.T.Helper()
	harness.PreparePayoutOnboarding(userId, acceptPayments)
	if !harness.Payments.Application.Container.Settings.Wallets.UsesProviderWallets(harness.countryOf(userId)) {
		account, err := harness.Payments.Application.Gateway.FindConnectedAccountForUser(context.Background(), harness.Database, userId)
		if err != nil {
			harness.T.Fatalf("payout account for %s was not created by the worker: %v", userId, err)
		}
		if acceptPayments {
			return account.SettlementSubaccountCode
		}
		return account.RecipientCode
	}
	harness.CompleteBvnConsent(userId)
	wallet, err := harness.Payments.Application.Gateway.FindProviderWallet(context.Background(), harness.Database, userId)
	if err != nil {
		harness.T.Fatalf("payout wallet for %s was not created: %v", userId, err)
	}
	return wallet.AccountRef
}

func (harness *MoneyHarness) PreparePayoutOnboarding(userId string, acceptPayments bool) {
	harness.T.Helper()
	ctx := context.Background()
	gateway := harness.Payments.Application.Gateway
	harness.SetCountry(userId, "NG")
	role := "creator"
	if acceptPayments {
		role = "seller"
	}
	if err := gateway.SavePayoutOnboardingIdentity(ctx, userId, services.OnboardingIdentityInput{
		Role: role, LegalName: "Temitope Adeyemi", DateOfBirth: "1994-02-03", AddressLine1: "4 Allen Avenue", City: "Ikeja", State: "Lagos", IdType: "bvn", IdNumber: "22212345678",
	}); err != nil {
		harness.T.Fatalf("identity for %s: %v", userId, err)
	}
	if err := gateway.SavePayoutOnboardingBank(ctx, userId, services.OnboardingBankInput{BankCode: "058", BankName: "Guaranty Trust Bank", AccountNumber: TestBankAccountNumberFor(userId)}); err != nil {
		harness.T.Fatalf("bank for %s: %v", userId, err)
	}
	gateway.ProcessDueConnectedAccountJobs(ctx, 20)
}

func (harness *MoneyHarness) CompleteBvnConsent(userId string) {
	harness.T.Helper()
	token := harness.Tokens.UserAccessToken(userId)
	started := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/bank-validation", token, "", nil)
	if started.Status != http.StatusAccepted || started.Body["consentUrl"] == nil {
		harness.T.Fatalf("bvn consent start for %s: %d %s", userId, started.Status, started.Raw)
	}
	polled := harness.Call(http.MethodGet, "/api/v1/payments/payout-onboarding/me/bank-validation", token, "", nil)
	if polled.Body["status"] != "verified" {
		harness.T.Fatalf("bvn consent result for %s: %d %s", userId, polled.Status, polled.Raw)
	}
	level, err := harness.Payments.Application.Gateway.ReadVerificationLevel(context.Background(), userId)
	if err != nil || level.Level < models.VerificationLevelPayout {
		harness.T.Fatalf("expected L1 for %s, got %+v %v", userId, level, err)
	}
}

func (harness *MoneyHarness) WalletRef(userId string) string {
	harness.T.Helper()
	wallet, err := harness.Payments.Application.Gateway.FindProviderWallet(context.Background(), harness.Database, userId)
	if err != nil {
		harness.T.Fatalf("wallet for %s: %v", userId, err)
	}
	return wallet.AccountRef
}

func (harness *MoneyHarness) DeliverWebhook(body []byte, headers http.Header) HarnessResponse {
	harness.T.Helper()
	return harness.Call(http.MethodPost, "/webhooks/flutterwave", "", "", body, headers)
}

func (harness *MoneyHarness) DeliverProviderEvent(event string, data map[string]any) HarnessResponse {
	harness.T.Helper()
	body, headers := SignedFlutterwaveWebhook(event, data)
	response := harness.DeliverWebhook(body, headers)
	if response.Status != http.StatusOK {
		harness.T.Fatalf("%s webhook: %d %s", event, response.Status, response.Raw)
	}
	return response
}

func (harness *MoneyHarness) DepositToWallet(userId string, amountMinor int64) string {
	harness.T.Helper()
	reference := fmt.Sprintf("PSA_%d", time.Now().UnixNano())
	body, headers := harness.Flutterwave.FundWalletAndSignWebhook(harness.WalletRef(userId), amountMinor, reference, 0)
	if response := harness.DeliverWebhook(body, headers); response.Status != http.StatusOK {
		harness.T.Fatalf("funding webhook: %d %s", response.Status, response.Raw)
	}
	return reference
}

func (harness *MoneyHarness) RunMoneyWorkers() {
	ctx := context.Background()
	gateway := harness.Payments.Application.Gateway
	for range 4 {
		gateway.ProcessDueMovements(ctx, 100)
	}
	gateway.ReleaseDueWalletHolds(ctx, 100)
}

func (harness *MoneyHarness) PayCheckout(reference string, feeMinor int64, paymentType string) *FakeFlwTransaction {
	harness.T.Helper()
	return harness.CompleteCheckoutWithPaymentType(reference, 0, feeMinor, paymentType)
}

func (harness *MoneyHarness) CompleteCheckoutThroughWebhook(reference string, paidAmountOverride, feeMinor int64) *FakeFlwTransaction {
	harness.T.Helper()
	return harness.CompleteCheckoutWithPaymentType(reference, paidAmountOverride, feeMinor, "card")
}

func (harness *MoneyHarness) CompleteCheckoutWithPaymentType(reference string, paidAmountOverride, feeMinor int64, paymentType string) *FakeFlwTransaction {
	harness.T.Helper()
	transaction := harness.Flutterwave.CompleteCheckout(reference, paidAmountOverride, feeMinor, paymentType)
	if transaction == nil {
		harness.T.Fatalf("no checkout for %s", reference)
	}
	body, headers := harness.Flutterwave.ChargeWebhook(transaction)
	if response := harness.DeliverWebhook(body, headers); response.Status != http.StatusOK {
		harness.T.Fatalf("charge webhook for %s: %d %s", reference, response.Status, response.Raw)
	}
	return transaction
}

func TestBankAccountNumberFor(userId string) string {
	digest := fnv.New32a()
	_, _ = digest.Write([]byte(userId))
	return fmt.Sprintf("2%09d", digest.Sum32()%1_000_000_000)
}

func (harness *MoneyHarness) SettleCardPayments(currency string) {
	harness.T.Helper()
	harness.Flutterwave.SettleAll(currency)
	harness.Payments.Application.Gateway.ProcessProviderSettlements(context.Background(), nil)
	harness.RunMoneyWorkers()
}

func (harness *MoneyHarness) FinishTransfer(reference string, succeeded bool) {
	harness.T.Helper()
	outcome := interfaces.OutcomeFailed
	if succeeded {
		outcome = interfaces.OutcomeSucceeded
	}
	if !harness.Flutterwave.SetPayoutOutcome(reference, outcome) {
		harness.T.Fatalf("no transfer %s at the provider", reference)
	}
	body, headers := harness.Flutterwave.TransferWebhook(reference)
	if response := harness.DeliverWebhook(body, headers); response.Status != http.StatusOK {
		harness.T.Fatalf("transfer webhook for %s: %d %s", reference, response.Status, response.Raw)
	}
}

func (harness *MoneyHarness) SeedWalletAvailable(userId string, amountMinor int64) {
	harness.T.Helper()
	ref := harness.WalletRef(userId)
	reference := fmt.Sprintf("seed-wallet-%s-%d", userId, time.Now().UnixNano())
	err := databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{Reference: reference, Kind: "test.seedWallet", Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.ProviderWalletMirrorAccount("flutterwave", ref, "NGN"), Direction: ledgermodels.Debit, AmountMinor: amountMinor},
			{Account: ledgermodels.WalletAvailableAccount(userId, "NGN"), Direction: ledgermodels.Credit, AmountMinor: amountMinor},
		}})
		return err
	})
	if err != nil {
		harness.T.Fatal(err)
	}
	harness.Flutterwave.CreditWalletWithoutFee(ref, amountMinor, reference)
}

func (harness *MoneyHarness) countryOf(userId string) string {
	harness.T.Helper()
	var country string
	if err := harness.Database.QueryRow(`SELECT coalesce(country_code, '') FROM "`+harness.UsersSchema+`".profiles WHERE account_id = $1::uuid LIMIT 1`, userId).Scan(&country); err != nil {
		harness.T.Fatal(err)
	}
	return country
}
