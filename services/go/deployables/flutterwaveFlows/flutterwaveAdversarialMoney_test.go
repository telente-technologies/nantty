package flutterwaveflows

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
	"zudomart/modules/payments/src/interfaces"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
)

func (harness *flowHarness) fundedSellerWithPayoutAccount(amountMinor int64) (string, string) {
	harness.T.Helper()
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	harness.deposit(user, amountMinor)
	accountId := harness.addPayoutAccount(user, "058")
	harness.advance(73 * time.Hour)
	harness.runWorkers()
	return user, accountId
}

func TestWithdrawalRacedAgainstAPurchaseNeverSpendsTheSameMoneyTwice(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, accountId := harness.fundedSellerWithPayoutAccount(500_000)
	seller := harness.newUser("NG")
	harness.verifyToLevelOne(seller)
	available := harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN"))
	placed := harness.registerOrder(buyer, seller, available, "NGN", "escrow")
	harness.initialize(buyer, &placed)
	var group sync.WaitGroup
	results := make([]paymentstesting.HarnessResponse, 2)
	group.Add(2)
	go func() { defer group.Done(); results[0] = harness.payWithWallet(buyer, placed, "race-pay-0001") }()
	go func() {
		defer group.Done()
		results[1] = harness.withdraw(buyer, accountId, available, "race-wd-00001", true)
	}()
	group.Wait()
	succeeded := 0
	for _, result := range results {
		if result.Status < 300 {
			succeeded++
		}
	}
	if succeeded != 1 {
		t.Fatalf("exactly one of the purchase and the withdrawal may win: %d %s / %d %s", results[0].Status, results[0].Raw, results[1].Status, results[1].Raw)
	}
	if left := harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")); left != 0 {
		t.Fatalf("available must be exactly spent once, left %d", left)
	}
	harness.AssertLedgerHealthy()
}

func TestWithdrawalWhoseReplyWasLostIsConfirmedByReferenceAndPaidOnce(t *testing.T) {
	harness := startFlowHarness(t)
	user, accountId := harness.fundedSellerWithPayoutAccount(500_000)
	requested := harness.withdraw(user, accountId, 200_000, "lost-wd-0001", true)
	if requested.Status >= 300 {
		t.Fatalf("withdraw: %d %s", requested.Status, requested.Raw)
	}
	harness.fake.LoseNextWriteReply(paymentstesting.FakeWriteTransfer)
	harness.wallet.Payouts.Withdrawals.RunPayoutBatch(context.Background(), 5)
	reference := requested.Body["reference"].(string)
	harness.fake.SetPayoutOutcome(reference, interfaces.OutcomeSucceeded)
	harness.advance(time.Hour)
	for range 3 {
		harness.wallet.Payouts.Withdrawals.FinalizeProcessingWithdrawalsOlderThan(context.Background(), time.Minute)
	}
	transfers := 0
	for _, request := range harness.fake.RequestLog() {
		if request == "POST /v3/transfers" {
			transfers++
		}
	}
	if transfers != 2 {
		t.Fatalf("one sweep transfer and one withdrawal transfer, never a retry; got %d", transfers)
	}
	if reserved := harness.balance(ledgermodels.WalletReservedPayoutAccount(user, "NGN")); reserved != 0 {
		t.Fatalf("withdrawal must be settled from the GET, reserved %d", reserved)
	}
	harness.assertWalletMatchesProvider(user)
}

func TestFundingReversedAfterSpendLeavesADebtAndRaisesAnAlert(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(buyer)
	harness.verifyToLevelOne(seller)
	reference := harness.deposit(buyer, 400_000)
	harness.runWorkers()
	spend := harness.balance(ledgermodels.WalletDepositHoldAccount(buyer, "NGN"))
	placed := harness.registerOrder(buyer, seller, spend, "NGN", "escrow")
	harness.initialize(buyer, &placed)
	if paid := harness.payWithWallet(buyer, placed, "spend-before-rev"); paid.Status != http.StatusOK {
		t.Fatalf("spend: %d %s", paid.Status, paid.Raw)
	}
	alertsBefore := paymentservices.PaymentAlertCount("walletDebt")
	harness.fake.ReverseFundingAtBank(reference)
	report, err := harness.gateway.RunDailyWalletReconciliation(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if report.ReversalsApplied != 1 {
		t.Fatalf("the reversal must be applied: %+v", report)
	}
	if debt := harness.balance(ledgermodels.WalletDebtAccount(buyer, "NGN")); debt <= 0 {
		t.Fatalf("spent money that was reversed becomes a debt, got %d", debt)
	}
	if paymentservices.PaymentAlertCount("walletDebt") <= alertsBefore {
		t.Fatal("a debt must raise an alert")
	}
	harness.AssertLedgerHealthy()
}

func TestChargebackAfterReleaseClawsBackFromTheSellerThenRecordsDebt(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(seller)
	placed := harness.registerOrder(buyer, seller, 200_000, "NGN", "escrow")
	harness.initialize(buyer, &placed)
	harness.payByCard(placed, 3_000)
	harness.fake.FundMainBalance("NGN", 1_000_000)
	harness.settleCard("NGN")
	if err := harness.confirmReceipt(buyer, placed); err != nil {
		t.Fatal(err)
	}
	harness.runWorkers()
	third := harness.newUser("NG")
	harness.verifyToLevelOne(third)
	spent := harness.balance(ledgermodels.WalletDepositHoldAccount(seller, "NGN")) - 50_000
	sellerOrder := harness.registerOrder(seller, third, spent, "NGN", "escrow")
	harness.initialize(seller, &sellerOrder)
	if paid := harness.payWithWallet(seller, sellerOrder, "seller-spends-01"); paid.Status != http.StatusOK {
		t.Fatalf("seller spend: %d %s", paid.Status, paid.Raw)
	}
	chargeback, opened := harness.fake.OpenChargeback(placed.reference, 0)
	if !opened {
		t.Fatal("no chargeback")
	}
	if _, err := harness.gateway.PollOpenProviderDisputes(context.Background()); err != nil {
		t.Fatal(err)
	}
	harness.fake.ResolveChargeback(itoa(chargeback["id"].(int64)), false)
	if _, err := harness.gateway.PollOpenProviderDisputes(context.Background()); err != nil {
		t.Fatal(err)
	}
	harness.runWorkers()
	if held := harness.escrowFor(placed); held.Status != "clawedBack" {
		t.Fatalf("escrow after a lost chargeback: %s", held.Status)
	}
	if left := harness.balance(ledgermodels.WalletDepositHoldAccount(seller, "NGN")) + harness.balance(ledgermodels.WalletAvailableAccount(seller, "NGN")); left != 0 {
		t.Fatalf("everything the seller still had is clawed back first, left %d", left)
	}
	if debt := harness.balance(ledgermodels.WalletDebtAccount(seller, "NGN")); debt != spent {
		t.Fatalf("the rest becomes the seller's debt: %d, want %d", debt, spent)
	}
	if receivable := harness.balance(ledgermodels.PlatformChargebackReceivableAccount("flutterwave", "NGN")); receivable != 0 {
		t.Fatalf("the chargeback receivable is fully covered by recovery and debt, left %d", receivable)
	}
	harness.assertWalletMatchesProvider(seller)
	harness.AssertLedgerHealthy()
}

func TestWalletDeletedAtTheProviderIsFrozenAndCannotWithdraw(t *testing.T) {
	harness := startFlowHarness(t)
	user, accountId := harness.fundedSellerWithPayoutAccount(300_000)
	harness.fake.DeleteWalletAtProvider(harness.walletRef(user))
	report, err := harness.gateway.RunDailyWalletReconciliation(context.Background())
	if err != nil || report.Status != "drift" {
		t.Fatalf("reconciliation must flag the deleted wallet: %+v %v", report, err)
	}
	refused := harness.withdraw(user, accountId, 100_000, "deleted-wd-01", true)
	if refused.Status < 400 || refused.Body["code"] != "WALLET_ON_HOLD" {
		t.Fatalf("a frozen wallet must not withdraw: %d %s", refused.Status, refused.Raw)
	}
}

func TestReconciliationAlertsOnMoneyThatLeftAWalletOutsideTheLedger(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	harness.deposit(user, 600_000)
	harness.runWorkers()
	clean, err := harness.gateway.RunDailyWalletReconciliation(context.Background())
	if err != nil || clean.Status != "clean" {
		t.Fatalf("a healthy wallet reconciles clean: %+v %v", clean, err)
	}
	before := paymentservices.PaymentAlertCount("reconciliation.walletDrift")
	harness.fake.DebitWalletOutsideLedger(harness.walletRef(user), "NGN", 50_000)
	report, err := harness.gateway.RunDailyWalletReconciliation(context.Background())
	if err != nil || report.Status != "drift" {
		t.Fatalf("drift must be reported: %+v %v", report, err)
	}
	if paymentservices.PaymentAlertCount("reconciliation.walletDrift") != before+1 {
		t.Fatal("drift must raise the walletDrift alert metric")
	}
	wallet, _ := harness.gateway.FindProviderWallet(context.Background(), harness.Database, user)
	if wallet.Status != "frozen" {
		t.Fatalf("a drifting wallet is frozen, status %s", wallet.Status)
	}
}
