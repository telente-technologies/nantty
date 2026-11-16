package payments_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/platform/sellingeligibility"
)

func TestUnverifiedSellerOverTheTenThousandNairaDebtLimitCannotSellUntilTheLimitAllowsIt(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	container := harness.Payments.Application.Container
	gateway := harness.Payments.Application.Gateway
	seller := uuid.NewString()
	ctx := context.Background()
	postDebt := func(reference string, amountMinor int64) {
		err := databases.RunInMoneyTransaction(ctx, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
			_, err := container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{Reference: reference, Kind: "test.sellerDebt", Lines: []ledgermodels.JournalLineRequest{
				{Account: ledgermodels.SellerDebtAccount(seller, "NGN"), Direction: ledgermodels.Debit, AmountMinor: amountMinor},
				{Account: ledgermodels.SellerAvailableAccount(seller, "NGN"), Direction: ledgermodels.Credit, AmountMinor: amountMinor},
			}})
			return err
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	postDebt("debt-under-"+seller, 1_000_000)
	if err := gateway.RequireSellerMaySell(ctx, seller); err != nil {
		t.Fatalf("an unverified seller owing exactly ₦10,000 may still sell: %v", err)
	}
	postDebt("debt-over-"+seller, 1)
	err := gateway.RequireSellerMaySell(ctx, seller)
	if !errors.Is(err, sellingeligibility.ErrSellerDebtLimit) {
		t.Fatalf("debt above the limit must block selling with SELLER_DEBT_LIMIT, got %v", err)
	}
	eligibility, _ := gateway.ReadSellingEligibility(ctx, seller)
	if eligibility.CanSell || eligibility.BlockedBy != sellingeligibility.BlockedByDebt || sellingeligibility.RefusalFor(eligibility) != sellingeligibility.ErrSellerDebtLimit {
		t.Fatalf("the internal endpoint reports the debt block to catalog: %+v", eligibility)
	}
	container.Settings.SellerDebtLimits.Base.Unverified = 2_000_000
	if err := gateway.RequireSellerMaySell(ctx, seller); err != nil {
		t.Fatalf("a higher configured limit lets the seller sell again: %v", err)
	}
	container.Settings.SellerDebtLimits.Base.Unverified = 1_000_000
}
