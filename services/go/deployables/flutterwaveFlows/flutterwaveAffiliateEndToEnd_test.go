package flutterwaveflows

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/generated/ent/affiliatecommission"
	affiliateservices "zudomart/modules/creators/src/modules/affiliates/services"
	"zudomart/modules/creators/src/repositories"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

type walletSnapshot struct{ seller, creator int64 }

func (scene *affiliateScene) snapshot() walletSnapshot {
	return walletSnapshot{seller: scene.spendable(scene.seller), creator: scene.spendable(scene.creator)}
}

func (scene *affiliateScene) decodeOrderEvent(payload map[string]any, into any) {
	scene.harness.T.Helper()
	encoded, err := json.Marshal(payload)
	if err == nil {
		err = json.Unmarshal(encoded, into)
	}
	if err != nil {
		scene.harness.T.Fatal(err)
	}
}

func TestAffiliateSaleFromLinkToCompletionAndRefundMovesMoneyOnlyAtCompletion(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	ctx := context.Background()
	store := repositories.StoreSummary{Id: scene.storeId, Name: "Ada Fabrics", OwnerUserId: scene.seller, Currency: "NGN", Active: true}
	scene.creators.Container.Directory = repositories.StaticCreatorsDirectory{
		Stores:   map[string]repositories.StoreSummary{scene.storeId: store},
		Products: map[string]repositories.ProductSummary{scene.productId: {Id: scene.productId, StoreId: scene.storeId, Name: "Ankara dress", PriceMinor: 500_000, Currency: "NGN", Published: true}},
		Users:    map[string]repositories.UserSummary{scene.creator: {Id: scene.creator, Username: "ada"}},
	}
	affiliates := scene.creators.Affiliates
	enabled, bps := true, int64(1000)
	if _, err := affiliates.UpdateSettings(ctx, store, affiliateservices.SettingsChange{Enabled: &enabled, DefaultCommissionBps: &bps}); err != nil {
		t.Fatal(err)
	}
	if _, err := affiliates.SetProductCommission(ctx, store, scene.seller, scene.productId, &bps, false); err != nil {
		t.Fatal(err)
	}
	link, err := affiliates.CreateAffiliateLink(ctx, scene.creator, scene.productId)
	if err != nil {
		t.Fatal(err)
	}
	click, err := affiliates.RecordAffiliateLinkClick(ctx, link.Id, affiliateservices.AffiliateLinkViewer{UserId: scene.buyer})
	if err != nil || click.Attribution.Source != "link" || click.ProductId != scene.productId {
		t.Fatalf("click: %+v %v", click, err)
	}
	orderId, attributedAt, orderedAt := uuid.NewString(), time.Now().UTC(), time.Now().UTC()
	item := map[string]any{"orderItemId": orderId + ":1", "productId": scene.productId, "quantity": 1, "lineTotalMinor": 500_000, "currency": "NGN",
		"attributionSource": click.Attribution.Source, "attributionId": click.Attribution.Id, "attributedAt": attributedAt, "commissionBasisPoints": bps}
	base := map[string]any{"orderGroupId": orderId, "orderNumber": "ZM-7001", "orderedAt": orderedAt, "storeId": scene.storeId, "sellerAccountId": scene.seller,
		"buyerAccountId": scene.buyer, "subtotalMinor": 500_000, "totalMinor": 500_000, "currency": "NGN", "attributedItems": []any{item}}
	start := scene.snapshot()
	var paid affiliateservices.OrderGroupPaid
	scene.decodeOrderEvent(base, &paid)
	for range 2 {
		if _, err := affiliates.RecordAwaitingAttributedSales(ctx, paid.Sale()); err != nil {
			t.Fatal(err)
		}
	}
	for _, status := range []string{"processing", "shipped", "delivered"} {
		if _, voids := (affiliateservices.OrderGroupStatusChanged{OrderGroupId: orderId, From: "new", To: status}).VoidReason(); voids {
			t.Fatalf("%s must not touch the pending commission", status)
		}
		scene.harness.runWorkers()
		if now := scene.snapshot(); now != start {
			t.Fatalf("no money moves while the order is %s: %+v vs %+v", status, now, start)
		}
		scene.harness.AssertLedgerHealthy()
	}
	if count, _ := scene.creators.Container.Client(scene.harness.Database).AffiliateCommission.Query().Where(affiliatecommission.OrderID(orderId)).Count(ctx); count != 0 {
		t.Fatalf("no commission exists before completion: %d", count)
	}
	var completed affiliateservices.OrderGroupCompleted
	scene.decodeOrderEvent(base, &completed)
	credited := 0
	for range 3 {
		n, err := affiliates.CreditCommissionsForRelease(ctx, completed.Sale())
		if err != nil {
			t.Fatal(err)
		}
		credited += n
		scene.harness.runWorkers()
	}
	if credited != 1 {
		t.Fatalf("completion credits exactly once: %d", credited)
	}
	afterCompletion := scene.snapshot()
	if afterCompletion.seller != start.seller-50_000 || afterCompletion.creator != start.creator+50_000 {
		t.Fatalf("10%% moves from seller to creator once: %+v -> %+v", start, afterCompletion)
	}
	if row := scene.commission(orderId); row.Status != affiliatecommission.StatusPaid || row.OrderNumber != "ZM-7001" || row.CreatorHandle != "ada" {
		t.Fatalf("commission: %+v", row)
	}
	assertStatementHas(t, scene.statementLines(scene.seller), "debit Affiliate commission to @ada, 10% on order #ZM-7001 (Ankara dress)")
	assertStatementHas(t, scene.statementLines(scene.creator), "credit Affiliate commission from Ada Fabrics, order #ZM-7001 (Ankara dress)")
	scene.harness.AssertLedgerHealthy()
	scene.refund(orderId, 500_000, 500_000, "escrow.refunded")
	scene.harness.runWorkers()
	if final := scene.snapshot(); final != start {
		t.Fatalf("a refund after completion returns the commission: %+v vs start %+v", final, start)
	}
	if row := scene.commission(orderId); row.Status != affiliatecommission.StatusReversed {
		t.Fatalf("reversed: %+v", row)
	}
	assertStatementHas(t, scene.statementLines(scene.seller), "credit Affiliate commission returned by @ada after a refund, order #ZM-7001 (Ankara dress)")
	assertStatementHas(t, scene.statementLines(scene.creator), "debit Affiliate commission reversed to Ada Fabrics after a refund, order #ZM-7001 (Ankara dress)")
	if debt := scene.harness.balance(ledgermodels.WalletDebtAccount(scene.creator, "NGN")); debt != 0 {
		t.Fatalf("the creator still held the commission, so no debt: %d", debt)
	}
	scene.assertWalletsMatchProvider()
}

func assertStatementHas(t *testing.T, lines []string, expected string) {
	t.Helper()
	for _, line := range lines {
		if line == expected {
			return
		}
	}
	t.Fatalf("statement is missing %q: %v", expected, lines)
}
