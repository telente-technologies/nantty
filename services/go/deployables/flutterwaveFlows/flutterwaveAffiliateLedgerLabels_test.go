package flutterwaveflows

import (
	"context"
	"slices"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/repositories"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
)

func (scene *affiliateScene) statementLines(userId string) []string {
	scene.harness.T.Helper()
	lines, _, err := scene.harness.Ledger.ListStatementLinesNewestFirst(context.Background(), scene.harness.Database, ledgerservices.StatementPageRequest{
		Accounts: []ledgermodels.AccountRef{ledgermodels.WalletAvailableAccount(userId, "NGN"), ledgermodels.WalletDepositHoldAccount(userId, "NGN")}, Limit: 100,
	})
	if err != nil {
		scene.harness.T.Fatal(err)
	}
	described := []string{}
	for _, line := range lines {
		direction := "debit"
		if line.IncreasesBalance {
			direction = "credit"
		}
		described = append(described, direction+" "+line.Description)
	}
	return described
}

func TestAffiliateCommissionLinesNameTheCounterpartyAndTheReasonOnBothSides(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	scene.creators.Container.Directory = repositories.StaticCreatorsDirectory{
		Owners:   map[string]string{"post:p1": scene.creator},
		Stores:   map[string]repositories.StoreSummary{scene.storeId: {Id: scene.storeId, Name: "Ada Fabrics", OwnerUserId: scene.seller, Currency: "NGN", Active: true}},
		Products: map[string]repositories.ProductSummary{scene.productId: {Id: scene.productId, StoreId: scene.storeId, Name: "Ankara dress", PriceMinor: 500_000, Currency: "NGN", Published: true}},
		Users:    map[string]repositories.UserSummary{scene.creator: {Id: scene.creator, Username: "ada"}},
	}
	orderId := uuid.NewString()
	sale := scene.sale(orderId, 500_000)
	sale.OrderNumber = "1234"
	scene.credit(sale)
	scene.harness.runWorkers()
	scene.refund(orderId, 500_000, 500_000, "escrow.refunded")
	scene.harness.runWorkers()
	seller, creator := scene.statementLines(scene.seller), scene.statementLines(scene.creator)
	for _, expected := range []string{"debit Affiliate commission to @ada, 10% on order #1234 (Ankara dress)", "credit Affiliate commission returned by @ada after a refund, order #1234 (Ankara dress)"} {
		if !slices.Contains(seller, expected) {
			t.Fatalf("seller statement is missing %q: %v", expected, seller)
		}
	}
	for _, expected := range []string{"credit Affiliate commission from Ada Fabrics, order #1234 (Ankara dress)", "debit Affiliate commission reversed to Ada Fabrics after a refund, order #1234 (Ankara dress)"} {
		if !slices.Contains(creator, expected) {
			t.Fatalf("creator statement is missing %q: %v", expected, creator)
		}
	}
	scene.assertWalletsMatchProvider()
}
