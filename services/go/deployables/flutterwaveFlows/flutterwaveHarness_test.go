package flutterwaveflows

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	escrowsrc "nantty/modules/escrow/src"
	escrowconfigs "nantty/modules/escrow/src/configs"
	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	walletsrc "nantty/modules/wallet/src"
	walletconfigs "nantty/modules/wallet/src/configs"
)

type flowHarness struct {
	*paymentstesting.MoneyHarness
	fake        *paymentstesting.FakeFlutterwave
	gateway     *paymentservices.PaymentGateway
	escrow      *escrowsrc.Module
	wallet      *walletsrc.Module
	usersSchema string
	clock       time.Time
}

func startFlowHarness(t *testing.T) *flowHarness {
	t.Helper()
	money := paymentstesting.StartMoneyHarnessWithFlutterwave(t)
	harness := &flowHarness{MoneyHarness: money, fake: money.Flutterwave, gateway: money.Payments.Application.Gateway, clock: time.Now().UTC()}
	harness.usersSchema = money.UsersSchema
	container := money.Payments.Application.Container
	container.Now = func() time.Time { return harness.clock }
	escrowSettings := escrowconfigs.EscrowSettings{
		Money:                 moneytesting.MoneyModuleSettingsForTests("escrow", moneytesting.CreateEmptySchema(t, money.Database, "escrow"), money.LedgerSchema),
		PlatformCommissionBps: 150, InspectionPeriod: 72 * time.Hour, SellerResponseWindow: 48 * time.Hour, AutoReleaseSweepInterval: time.Hour,
		SellerCreditHoldPeriod: 24 * time.Hour, InternalApiToken: strings.Repeat("e", 32),
	}
	escrow, err := escrowsrc.StartEscrowModuleWithSettings(context.Background(), escrowSettings, money.Dependencies, money.Overrides(), harness.gateway)
	if err != nil {
		t.Fatal(err)
	}
	money.MountModule(escrow)
	escrow.Application.Container.Now = func() time.Time { return harness.clock }
	harness.escrow = escrow
	walletSettings := walletconfigs.WalletSettings{
		Money:              moneytesting.MoneyModuleSettingsForTests("wallet", moneytesting.CreateEmptySchema(t, money.Database, "wallet"), money.LedgerSchema),
		CoinTransferFeeBps: 2500, CoinCashValueMinorByCurrency: walletconfigs.ParseCurrencyAmounts("NGN:1000"),
		MinimumPayoutMinorByCurrency: walletconfigs.ParseCurrencyAmounts("NGN:1000"), MinimumWithdrawalMinor: 100, DataEncryptionKey: bytes.Repeat([]byte{9}, 32),
		DefaultCurrency: "NGN", WithdrawalLimits: walletconfigs.WithdrawalLimits{MaximumPerDay: 3, MinimumGap: 10 * time.Minute, NewAccountCooldown: 48 * time.Hour, BlockWhileProcessing: true},
		PayoutRunInterval: time.Hour, CreatorTransferMinimum: walletconfigs.ParseCurrencyAmounts("NGN:10000"), InternalApiToken: strings.Repeat("w", 32),
		CoinNetValueMinorByCurrency: walletconfigs.ParseCurrencyAmounts("NGN:1000"), CoinChannelFeeBps: walletconfigs.ParseChannelFees("web:200"),
		UsersSchema: harness.usersSchema,
	}
	wallet, err := walletsrc.StartWalletModuleWithSettings(context.Background(), walletSettings, money.Dependencies, money.Overrides(), harness.gateway)
	if err != nil {
		t.Fatal(err)
	}
	money.MountModule(wallet)
	harness.wallet = wallet
	wallet.Payouts.Container.Now = func() time.Time { return harness.clock }
	return harness
}

func (harness *flowHarness) advance(duration time.Duration) {
	harness.clock = harness.clock.Add(duration)
}

func (harness *flowHarness) setCountry(userId, country string) {
	harness.T.Helper()
	if _, err := harness.Database.Exec(`INSERT INTO "`+harness.usersSchema+`".profiles (account_id, kind, country_code) VALUES ($1, 'personal', $2)`, userId, country); err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *flowHarness) markIdentityVerified(userId string) {
	harness.T.Helper()
	if _, err := harness.Database.Exec(`INSERT INTO "`+harness.usersSchema+`".verification_cases (account_id, status, liveness_result, face_match_result) VALUES ($1, 'approved', 'passed', 'passed')`, userId); err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *flowHarness) newUser(country string) string {
	userId := uuid.NewString()
	harness.setCountry(userId, country)
	return userId
}

func (harness *flowHarness) verifyToLevelOne(userId string) {
	harness.T.Helper()
	ctx := context.Background()
	if err := harness.gateway.SavePayoutOnboardingIdentity(ctx, userId, paymentservices.OnboardingIdentityInput{
		Role: "seller", LegalName: "Temitope Adeyemi", DateOfBirth: "1994-02-03", AddressLine1: "4 Allen Avenue", City: "Ikeja", State: "Lagos", IdType: "bvn", IdNumber: "22212345678",
	}); err != nil {
		harness.T.Fatalf("identity: %v", err)
	}
	if err := harness.gateway.SavePayoutOnboardingBank(ctx, userId, paymentservices.OnboardingBankInput{BankCode: "058", BankName: "GTBank", AccountNumber: paymentstesting.TestBankAccountNumberFor(userId)}); err != nil {
		harness.T.Fatalf("bank: %v", err)
	}
	harness.gateway.ProcessDueConnectedAccountJobs(ctx, 20)
	token := harness.Tokens.UserAccessToken(userId)
	started := harness.Call(http.MethodPost, "/api/v1/payments/payout-onboarding/me/bank-validation", token, "", nil)
	if started.Status != http.StatusAccepted || started.Body["consentUrl"] == nil {
		harness.T.Fatalf("bvn consent start: %d %s", started.Status, started.Raw)
	}
	polled := harness.Call(http.MethodGet, "/api/v1/payments/payout-onboarding/me/bank-validation", token, "", nil)
	if polled.Body["status"] != "verified" {
		harness.T.Fatalf("bvn consent result: %d %s", polled.Status, polled.Raw)
	}
	level, err := harness.gateway.ReadVerificationLevel(ctx, userId)
	if err != nil || level.Level < paymentmodels.VerificationLevelPayout {
		harness.T.Fatalf("expected L1, got %+v %v", level, err)
	}
}

func (harness *flowHarness) walletRef(userId string) string {
	harness.T.Helper()
	wallet, err := harness.gateway.FindProviderWallet(context.Background(), harness.Database, userId)
	if err != nil {
		harness.T.Fatalf("wallet for %s: %v", userId, err)
	}
	return wallet.AccountRef
}

func (harness *flowHarness) deliver(body []byte, headers http.Header) paymentstesting.HarnessResponse {
	harness.T.Helper()
	return harness.Call(http.MethodPost, "/webhooks/flutterwave", "", "", body, headers)
}

func (harness *flowHarness) deposit(userId string, amountMinor int64) string {
	harness.T.Helper()
	reference := fmt.Sprintf("PSA_%d", time.Now().UnixNano())
	body, headers := harness.fake.FundWalletAndSignWebhook(harness.walletRef(userId), amountMinor, reference, 0)
	if response := harness.deliver(body, headers); response.Status != http.StatusOK {
		harness.T.Fatalf("funding webhook: %d %s", response.Status, response.Raw)
	}
	return reference
}

func (harness *flowHarness) runWorkers() {
	ctx := context.Background()
	for range 4 {
		harness.gateway.ProcessDueMovements(ctx, 100)
	}
	harness.gateway.ReleaseDueWalletHolds(ctx, 100)
}

func (harness *flowHarness) balance(account ledgermodels.AccountRef) int64 {
	balance, err := harness.Ledger.ReadAccountBalance(context.Background(), harness.Database, account)
	if err != nil {
		harness.T.Fatal(err)
	}
	return balance
}

func (harness *flowHarness) mirror(userId string) int64 {
	return harness.balance(ledgermodels.ProviderWalletMirrorAccount("flutterwave", harness.walletRef(userId), "NGN"))
}

func (harness *flowHarness) assertWalletMatchesProvider(userId string) {
	harness.T.Helper()
	ref := harness.walletRef(userId)
	liabilities, err := harness.Ledger.SumBalancesOfAccountsWithCodePrefix(context.Background(), harness.Database, ledgermodels.WalletAccountCodePrefix(userId), "NGN")
	if err != nil {
		harness.T.Fatal(err)
	}
	if provider, mirror := harness.fake.WalletBalance(ref, "NGN"), harness.mirror(userId); provider != mirror || mirror != liabilities {
		harness.T.Fatalf("wallet %s: provider %d, ledger mirror %d, liabilities %d must all match", ref, provider, mirror, liabilities)
	}
}

func itoa(value int64) string { return fmt.Sprintf("%d", value) }

func testAccountNumber(userId string) string { return paymentstesting.TestBankAccountNumberFor(userId) }

func (harness *flowHarness) verifyToLevelOneExpectingRejection(userId string) {
	harness.T.Helper()
	ctx := context.Background()
	if err := harness.gateway.SavePayoutOnboardingIdentity(ctx, userId, paymentservices.OnboardingIdentityInput{
		Role: "seller", LegalName: "Temitope Adeyemi", DateOfBirth: "1994-02-03", AddressLine1: "4 Allen Avenue", City: "Ikeja", State: "Lagos", IdType: "bvn", IdNumber: "22212345678",
	}); err != nil {
		harness.T.Fatalf("identity: %v", err)
	}
	err := harness.gateway.SavePayoutOnboardingBank(ctx, userId, paymentservices.OnboardingBankInput{BankCode: "058", BankName: "GTBank", AccountNumber: testAccountNumber(userId)})
	if err == nil {
		harness.T.Fatal("a bank account in someone else's name must be refused")
	}
	level, _ := harness.gateway.ReadVerificationLevel(ctx, userId)
	if level.Level != 0 {
		harness.T.Fatalf("level must stay 0: %+v", level)
	}
}
