package creators

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/creators/src/generated/ent/affiliateattributedsale"
	"nantty/modules/creators/src/generated/ent/affiliatecommission"
	"nantty/modules/creators/src/generated/ent/creatorearning"
	affiliateservices "nantty/modules/creators/src/modules/affiliates/services"
	"nantty/modules/creators/src/repositories"
)

type affiliateWorkspaceScene struct {
	*httpHarness
	creator, seller, buyer, stranger string
	storeId, productId, otherId      string
	creatorToken, sellerToken        string
	linkId                           string
}

func startAffiliateWorkspaceScene(t *testing.T) *affiliateWorkspaceScene {
	scene := &affiliateWorkspaceScene{creator: uuid.NewString(), seller: uuid.NewString(), buyer: uuid.NewString(), stranger: uuid.NewString(),
		storeId: uuid.NewString(), productId: uuid.NewString(), otherId: uuid.NewString()}
	scene.httpHarness = startHttpHarness(t, repositories.StaticCreatorsDirectory{
		Owners: map[string]string{"post:" + scene.stranger: scene.stranger},
		Stores: map[string]repositories.StoreSummary{scene.storeId: {Id: scene.storeId, Name: "Ada Fabrics", OwnerUserId: scene.seller, Currency: "NGN", Active: true}},
		Products: map[string]repositories.ProductSummary{
			scene.productId: {Id: scene.productId, StoreId: scene.storeId, Name: "Ankara dress", PriceMinor: 2_000_000, Currency: "NGN", Published: true},
			scene.otherId:   {Id: scene.otherId, StoreId: scene.storeId, Name: "Silk scarf", PriceMinor: 500_000, Currency: "NGN", Published: true},
		},
		Users:     map[string]repositories.UserSummary{scene.creator: {Id: scene.creator, Username: "ada"}},
		Followers: map[string]int64{scene.creator: 5000},
		Stock:     map[string]int64{scene.productId: 7},
	})
	scene.makeCreator(scene.creator, "starter")
	scene.makeCreator(scene.stranger, "starter")
	scene.creatorToken, scene.sellerToken = scene.tokens.UserAccessToken(scene.creator), scene.tokens.UserAccessToken(scene.seller)
	if status, _ := scene.call(http.MethodPatch, "/api/v1/seller/affiliates/settings", scene.sellerToken, "", map[string]any{"enabled": true, "defaultCommissionBasisPoints": 1000, "autoApproveCreatorsWithFollowersAbove": 1000, "cookieWindowDays": 7}); status != http.StatusOK {
		t.Fatalf("settings: %d", status)
	}
	status, link := scene.call(http.MethodPost, "/api/v1/creators/me/affiliate-links", scene.creatorToken, "", map[string]any{"productId": scene.productId})
	if status != http.StatusOK || link["path"] != "/p/"+scene.productId+"?aff="+link["id"].(string) {
		t.Fatalf("an auto-approved creator gets a link straight away: %d %v", status, link)
	}
	scene.linkId = link["id"].(string)
	return scene
}

func (scene *affiliateWorkspaceScene) item(key, productId, source, sourceId string, attributedAt time.Time) affiliateservices.AttributedItem {
	return affiliateservices.AttributedItem{OrderItemId: key, ProductId: productId, LineTotalMinor: 1_000_000, Currency: "NGN", AttributionSource: source, AttributionId: sourceId, AttributedAt: &attributedAt}
}

func (scene *affiliateWorkspaceScene) paid(orderId, buyer string, items ...affiliateservices.AttributedItem) affiliateservices.OrderGroupPaid {
	orderedAt := time.Now().UTC()
	return affiliateservices.OrderGroupPaid{OrderGroupId: orderId, OrderNumber: "ZM-1234", StoreId: scene.storeId, SellerAccountId: scene.seller, BuyerAccountId: buyer, Currency: "NGN", OrderedAt: &orderedAt, AttributedItems: items}
}

func completedFrom(paid affiliateservices.OrderGroupPaid) affiliateservices.OrderGroupCompleted {
	return affiliateservices.OrderGroupCompleted{OrderGroupId: paid.OrderGroupId, OrderNumber: paid.OrderNumber, StoreId: paid.StoreId, SellerAccountId: paid.SellerAccountId,
		BuyerAccountId: paid.BuyerAccountId, Currency: paid.Currency, SubtotalMinor: 1_000_000 * int64(len(paid.AttributedItems)), OrderedAt: paid.OrderedAt, AttributedItems: paid.AttributedItems}
}

func (scene *affiliateWorkspaceScene) record(paid affiliateservices.OrderGroupPaid) int {
	recorded, err := scene.module.Affiliates.RecordAwaitingAttributedSales(context.Background(), paid.Sale())
	if err != nil {
		scene.t.Fatal(err)
	}
	return recorded
}

func (scene *affiliateWorkspaceScene) complete(paid affiliateservices.OrderGroupPaid) int {
	credited, err := scene.module.Affiliates.CreditCommissionsForRelease(context.Background(), completedFrom(paid).Sale())
	if err != nil {
		scene.t.Fatal(err)
	}
	return credited
}

func (scene *affiliateWorkspaceScene) changeStatus(orderId, from, to string) {
	changed := affiliateservices.OrderGroupStatusChanged{OrderGroupId: orderId, From: from, To: to}
	if reason, voids := changed.VoidReason(); voids {
		if _, err := scene.module.Affiliates.VoidAwaitingAttributedSales(context.Background(), orderId, reason); err != nil {
			scene.t.Fatal(err)
		}
	}
}

func (scene *affiliateWorkspaceScene) commissionsOf(orderId string) int {
	count, err := scene.module.Container.Client(scene.database).AffiliateCommission.Query().Where(affiliatecommission.OrderID(orderId)).Count(context.Background())
	if err != nil {
		scene.t.Fatal(err)
	}
	return count
}

func (scene *affiliateWorkspaceScene) saleStatus(orderId string) string {
	sale, err := scene.module.Container.Client(scene.database).AffiliateAttributedSale.Query().Where(affiliateattributedsale.OrderID(orderId)).Only(context.Background())
	if err != nil {
		return "none"
	}
	return sale.Status.String() + ":" + sale.VoidReason
}

func TestAffiliateCommissionIsOnlyEarnedWhenTheOrderCompletes(t *testing.T) {
	scene := startAffiliateWorkspaceScene(t)
	orderId := uuid.NewString()
	paid := scene.paid(orderId, scene.buyer, scene.item(orderId+":1", scene.productId, "link", scene.linkId, time.Now()))
	for range 2 {
		scene.record(paid)
	}
	for _, status := range []string{"processing", "shipped", "delivered"} {
		scene.changeStatus(orderId, "new", status)
	}
	if scene.commissionsOf(orderId) != 0 || scene.saleStatus(orderId) != "awaiting:" {
		t.Fatalf("paid, in escrow, shipped and delivered orders earn nothing yet: %d %s", scene.commissionsOf(orderId), scene.saleStatus(orderId))
	}
	_, pending := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-earnings?status=pending", scene.creatorToken, "", nil)
	rows := pending["data"].([]any)
	summary := pending["summary"].(map[string]any)
	if len(rows) != 1 || rows[0].(map[string]any)["payoutStatus"] != "awaiting_completion" || summary["pending"].([]any)[0].(map[string]any)["amountMinor"] != float64(100_000) || len(summary["earned"].([]any)) != 0 {
		t.Fatalf("the sale shows as pending until completion: %v", pending)
	}
	if credited := scene.complete(paid) + scene.complete(paid); credited != 1 || scene.commissionsOf(orderId) != 1 {
		t.Fatalf("a repeated completed event credits once: %d %d", credited, scene.commissionsOf(orderId))
	}
	scene.changeStatus(orderId, "completed", "refunded")
	if scene.saleStatus(orderId) != "completed:" {
		t.Fatalf("a refund after completion is handled by the reversal rules, not by voiding: %s", scene.saleStatus(orderId))
	}
	commission, err := scene.module.Container.Client(scene.database).AffiliateCommission.Query().Where(affiliatecommission.OrderID(orderId)).Only(context.Background())
	if err != nil || commission.CommissionMinor != 100_000 || commission.CreatorHandle != "ada" || commission.StoreName != "Ada Fabrics" || commission.ProductName != "Ankara dress" || commission.OrderNumber != "ZM-1234" {
		t.Fatalf("the commission keeps who and what it was for: %+v %v", commission, err)
	}
	if got := affiliateservices.SellerCommissionDebitDescription(commission); got != "Affiliate commission to @ada, 10% on order #ZM-1234 (Ankara dress)" {
		t.Fatalf("seller line: %q", got)
	}
	earning, err := scene.module.Container.Client(scene.database).CreatorEarning.Query().Where(creatorearning.CreatorID(scene.creator), creatorearning.KindEQ(creatorearning.KindAffiliate)).Only(context.Background())
	if err != nil || earning.Description != "Affiliate commission from Ada Fabrics, order #ZM-1234 (Ankara dress)" {
		t.Fatalf("creator line: %+v %v", earning, err)
	}
	_, earned := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-earnings?status=earned", scene.creatorToken, "", nil)
	if rows := earned["data"].([]any); len(rows) != 1 || rows[0].(map[string]any)["store"].(map[string]any)["name"] != "Ada Fabrics" || len(earned["summary"].(map[string]any)["pending"].([]any)) != 0 {
		t.Fatalf("earned: %v", earned)
	}
	assertHealthy(t, scene.creatorsHarness)
}

func TestAffiliateSalesCancelledRefundedOrDisputedBeforeCompletionPayNothing(t *testing.T) {
	scene := startAffiliateWorkspaceScene(t)
	refunded, cancelled, disputed := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for orderId, ending := range map[string]string{refunded: "refunded", cancelled: "cancelled"} {
		paid := scene.paid(orderId, scene.buyer, scene.item(orderId+":1", scene.productId, "link", scene.linkId, time.Now()))
		scene.record(paid)
		scene.changeStatus(orderId, "shipped", ending)
		if _, err := scene.module.Affiliates.ReverseCommissionsForRefund(context.Background(), affiliateservices.EscrowRefunded{EscrowId: "e-" + orderId, OrderId: orderId,
			Amount: affiliateservices.Money{AmountMinor: 1_000_000, Currency: "NGN"}, Refunded: affiliateservices.Money{AmountMinor: 1_000_000, Currency: "NGN"}}, "escrow.refunded"); err != nil {
			t.Fatal(err)
		}
		if scene.commissionsOf(orderId) != 0 || scene.saleStatus(orderId) != "voided:"+ending {
			t.Fatalf("%s before completion pays nothing: %d %s", ending, scene.commissionsOf(orderId), scene.saleStatus(orderId))
		}
	}
	paid := scene.paid(disputed, scene.buyer, scene.item(disputed+":1", scene.productId, "link", scene.linkId, time.Now()))
	scene.record(paid)
	scene.changeStatus(disputed, "delivered", "disputed")
	if scene.commissionsOf(disputed) != 0 || scene.saleStatus(disputed) != "awaiting:" {
		t.Fatalf("an open dispute holds the commission: %s", scene.saleStatus(disputed))
	}
	scene.changeStatus(disputed, "disputed", "refunded")
	if scene.saleStatus(disputed) != "voided:refunded" {
		t.Fatalf("a dispute settled with a refund voids it: %s", scene.saleStatus(disputed))
	}
	_, reversed := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-earnings?status=reversed", scene.creatorToken, "", nil)
	if rows := reversed["data"].([]any); len(rows) != 3 || reversed["summary"].(map[string]any)["reversed"].([]any)[0].(map[string]any)["amountMinor"] != float64(300_000) {
		t.Fatalf("reversed: %v", reversed)
	}
	if status, _ := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-earnings?status=everything", scene.creatorToken, "", nil); status != http.StatusBadRequest {
		t.Fatalf("unknown earning status: %d", status)
	}
}

func TestAffiliateAttributionRefusesSelfPurchasesStrangersStaleClicksAndForeignLinks(t *testing.T) {
	scene := startAffiliateWorkspaceScene(t)
	tooOld := time.Now().Add(-8 * 24 * time.Hour)
	cases := map[string]affiliateservices.OrderGroupPaid{}
	add := func(name, buyer string, item affiliateservices.AttributedItem) {
		orderId := uuid.NewString()
		item.OrderItemId = orderId + ":1"
		cases[name] = scene.paid(orderId, buyer, item)
	}
	add("own purchase", scene.creator, scene.item("", scene.productId, "link", scene.linkId, time.Now()))
	add("creator outside the programme", scene.buyer, scene.item("", scene.productId, "post", scene.stranger, time.Now()))
	add("expired attribution window", scene.buyer, scene.item("", scene.productId, "link", scene.linkId, tooOld))
	add("link used on another product", scene.buyer, scene.item("", scene.otherId, "link", scene.linkId, time.Now()))
	add("unknown link", scene.buyer, scene.item("", scene.productId, "link", uuid.NewString(), time.Now()))
	for name, paid := range cases {
		if recorded := scene.record(paid); recorded != 0 {
			t.Fatalf("%s: recorded %d pending sales", name, recorded)
		}
		if credited := scene.complete(paid); credited != 0 {
			t.Fatalf("%s: credited %d commissions", name, credited)
		}
	}
	_, clicked := scene.call(http.MethodPost, "/api/v1/affiliate-links/"+scene.linkId+"/clicks", scene.creatorToken, "", nil)
	scene.call(http.MethodPost, "/api/v1/affiliate-links/"+scene.linkId+"/clicks", "", "", nil)
	scene.call(http.MethodPost, "/api/v1/affiliate-links/"+scene.linkId+"/clicks", scene.tokens.UserAccessToken(scene.buyer), "", nil)
	if attribution := clicked["attribution"].(map[string]any); attribution["source"] != "link" || attribution["id"] != scene.linkId || clicked["productId"] != scene.productId || clicked["attributionWindowDays"] != float64(7) {
		t.Fatalf("click: %v", clicked)
	}
	if status, _ := scene.call(http.MethodPost, "/api/v1/affiliate-links/"+uuid.NewString()+"/clicks", "", "", nil); status != http.StatusNotFound {
		t.Fatalf("unknown link: %d", status)
	}
	_, promotions := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-promotions", scene.creatorToken, "", nil)
	if rows := promotions["data"].([]any); len(rows) != 1 || rows[0].(map[string]any)["clicks"] != float64(2) || rows[0].(map[string]any)["access"] != "approved" {
		t.Fatalf("the creator's own clicks don't count: %v", promotions)
	}
}

func TestProductLeavingTheProgrammeKeepsTheRateLockedAtCheckout(t *testing.T) {
	scene := startAffiliateWorkspaceScene(t)
	locked, zero := int64(1000), int64(0)
	before, after, unlocked := uuid.NewString(), uuid.NewString(), uuid.NewString()
	excludedBeforeCheckout := scene.item(before+":1", scene.productId, "link", scene.linkId, time.Now())
	excludedBeforeCheckout.CommissionBps = &zero
	excludedAfterCheckout := scene.item(after+":1", scene.productId, "link", scene.linkId, time.Now())
	excludedAfterCheckout.CommissionBps = &locked
	paidBefore, paidAfter := scene.paid(before, scene.buyer, excludedBeforeCheckout), scene.paid(after, scene.buyer, excludedAfterCheckout)
	paidUnlocked := scene.paid(unlocked, scene.buyer, scene.item(unlocked+":1", scene.productId, "link", scene.linkId, time.Now()))
	scene.record(paidAfter)
	scene.call(http.MethodPut, "/api/v1/seller/affiliates/product-commissions/"+scene.productId, scene.sellerToken, "", map[string]any{"commissionBasisPoints": nil, "excluded": true})
	scene.record(paidBefore)
	if credited := scene.complete(paidBefore); credited != 0 {
		t.Fatalf("a product excluded before checkout locks a zero rate: %d", credited)
	}
	if credited := scene.complete(paidAfter); credited != 1 {
		t.Fatalf("a product excluded after checkout still pays the rate the buyer checked out with: %d", credited)
	}
	if credited := scene.complete(paidUnlocked); credited != 0 {
		t.Fatalf("without a locked rate today's exclusion applies: %d", credited)
	}
	if status, body := scene.call(http.MethodPost, "/api/v1/creators/me/affiliate-links", scene.creatorToken, "", map[string]any{"productId": scene.productId}); status != http.StatusConflict || body["code"] != "PRODUCT_NOT_PROMOTABLE" {
		t.Fatalf("no new links for excluded products: %d %v", status, body)
	}
	_, catalog := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-catalog?sort=commission", scene.creatorToken, "", nil)
	if rows := catalog["data"].([]any); len(rows) != 1 || rows[0].(map[string]any)["productId"] != scene.otherId || rows[0].(map[string]any)["access"] != "open" {
		t.Fatalf("excluded products leave the catalog and the link only approved the dress: %v", catalog)
	}
	if status, _ := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-catalog?sort=random", scene.creatorToken, "", nil); status != http.StatusBadRequest {
		t.Fatalf("unknown sort: %d", status)
	}
	if status, _ := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-catalog", scene.tokens.UserAccessToken(scene.buyer), "", nil); status != http.StatusForbidden {
		t.Fatalf("only approved creators browse the catalog: %d", status)
	}
}

func TestCatalogShowsAccessStockAndTermsAndManualProgrammesNeedApproval(t *testing.T) {
	scene := startAffiliateWorkspaceScene(t)
	scene.call(http.MethodPatch, "/api/v1/seller/affiliates/settings", scene.sellerToken, "", map[string]any{"autoApproveCreatorsWithFollowersAbove": nil})
	_, catalog := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-catalog", scene.creatorToken, "", nil)
	byId := map[string]map[string]any{}
	for _, row := range catalog["data"].([]any) {
		byId[row.(map[string]any)["productId"].(string)] = row.(map[string]any)
	}
	dress, scarf := byId[scene.productId], byId[scene.otherId]
	if dress["access"] != "approved" || dress["stock"] != float64(7) || dress["commissionPercent"] != float64(10) || dress["estimatedCommission"].(map[string]any)["amountMinor"] != float64(200_000) || dress["link"] == nil {
		t.Fatalf("dress: %v", dress)
	}
	if scarf["access"] != "approval_required" || scarf["programme"].(map[string]any)["approval"] != "manual" || scarf["programme"].(map[string]any)["commissionPaidWhen"] != "order_completed" {
		t.Fatalf("scarf: %v", scarf)
	}
	if status, body := scene.call(http.MethodPost, "/api/v1/creators/me/affiliate-links", scene.creatorToken, "", map[string]any{"productId": scene.otherId}); status != http.StatusConflict || body["code"] != "AFFILIATION_PENDING" {
		t.Fatalf("a manual programme files a request instead of a link: %d %v", status, body)
	}
	_, requested := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-catalog?access=requested", scene.creatorToken, "", nil)
	if rows := requested["data"].([]any); len(rows) != 1 || rows[0].(map[string]any)["productId"] != scene.otherId {
		t.Fatalf("requested filter: %v", requested)
	}
	if status, _ := scene.call(http.MethodGet, "/api/v1/creators/me/affiliate-catalog", "", "", nil); status != http.StatusUnauthorized {
		t.Fatalf("guests are sent to sign in: %d", status)
	}
}
