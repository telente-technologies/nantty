package flutterwaveflows

import (
	"context"
	"net/http"
	"testing"
	"time"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/interfaces"
)

func TestWalletPurchaseLocksInTheBuyerWalletReleasesToTheSellerWalletAndTheSellerWithdrawsWithStepUp(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(buyer)
	harness.verifyToLevelOne(seller)
	harness.markSellerBusinessVerified(seller)
	harness.deposit(buyer, 1_000_000)
	harness.runWorkers()
	placed := harness.registerOrder(buyer, seller, 300_000, "NGN", "escrow")
	harness.initialize(buyer, &placed)
	paid := harness.payWithWallet(buyer, placed, "pay-00001")
	if paid.Status != http.StatusOK || paid.Body["status"] != "succeeded" {
		t.Fatalf("wallet payment: %d %s", paid.Status, paid.Raw)
	}
	held := harness.escrowFor(placed)
	if string(held.Custody) != "buyerWalletLock" || held.WalletFundedAt == nil {
		t.Fatalf("escrow must be locked in the buyer's funded wallet: %+v", held)
	}
	if locked := harness.balance(ledgermodels.WalletEscrowLockedAccount(buyer, held.ID.String(), "NGN")); locked != 300_000 {
		t.Fatalf("locked = %d", locked)
	}
	buyerProviderBefore := harness.fake.WalletBalance(harness.walletRef(buyer), "NGN")
	harness.assertWalletMatchesProvider(buyer)
	if err := harness.confirmReceipt(buyer, placed); err != nil {
		t.Fatal(err)
	}
	harness.runWorkers()
	released := harness.escrowFor(placed)
	if released.Status != "released" {
		t.Fatalf("escrow status %s", released.Status)
	}
	if moved := buyerProviderBefore - harness.fake.WalletBalance(harness.walletRef(buyer), "NGN"); moved != 300_000 {
		t.Fatalf("buyer wallet must pay out exactly the order, moved %d", moved)
	}
	if got := harness.fake.WalletBalance(harness.walletRef(seller), "NGN"); got != released.SellerAmountMinor {
		t.Fatalf("seller wallet holds %d, want %d", got, released.SellerAmountMinor)
	}
	if revenue := harness.balance(ledgermodels.PlatformEscrowFeeRevenueAccount("NGN")); revenue != released.CommissionMinor {
		t.Fatalf("commission revenue %d, want %d", revenue, released.CommissionMinor)
	}
	harness.assertWalletMatchesProvider(buyer)
	harness.assertWalletMatchesProvider(seller)
	accountId := harness.addPayoutAccount(seller, "058")
	if early := harness.withdraw(seller, accountId, 100_000, "wd-early-1", true); early.Status < 400 {
		t.Fatalf("money inside the hold and new-account cooldown must not be withdrawable: %d %s", early.Status, early.Raw)
	}
	harness.advance(49 * time.Hour)
	harness.runWorkers()
	if noStepUp := harness.withdraw(seller, accountId, 100_000, "wd-nostep-1", false); noStepUp.Status != http.StatusForbidden {
		t.Fatalf("withdrawal without step-up must be refused: %d %s", noStepUp.Status, noStepUp.Raw)
	}
	requested := harness.withdraw(seller, accountId, 100_000, "wd-000001", true)
	if requested.Status != http.StatusCreated && requested.Status != http.StatusOK {
		t.Fatalf("withdraw: %d %s", requested.Status, requested.Raw)
	}
	report := harness.wallet.Payouts.Withdrawals.RunPayoutBatch(context.Background(), 10)
	if report.Started != 1 {
		t.Fatalf("payout run: %+v", report)
	}
	reference := requested.Body["reference"].(string)
	transfer := harness.fake.TransferByReference(reference)
	if transfer == nil {
		t.Fatalf("no transfer for %s; report %+v; requests %v", reference, report, harness.fake.RequestLog())
	}
	if transfer.DebitSubaccount != harness.walletRef(seller) || !transfer.SkipBeneficiary {
		t.Fatalf("withdrawal must debit the seller's own wallet: %+v", transfer)
	}
	harness.fake.SetPayoutOutcome(reference, interfaces.OutcomeSucceeded)
	body, headers := harness.fake.TransferWebhook(reference)
	if response := harness.deliver(body, headers); response.Status != http.StatusOK {
		t.Fatalf("transfer webhook: %d %s", response.Status, response.Raw)
	}
	if reserved := harness.balance(ledgermodels.WalletReservedPayoutAccount(seller, "NGN")); reserved != 0 {
		t.Fatalf("reserved payout left %d", reserved)
	}
	harness.assertWalletMatchesProvider(seller)
	harness.AssertLedgerHealthy()
}
