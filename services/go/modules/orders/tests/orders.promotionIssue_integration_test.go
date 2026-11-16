package orders_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func promotionTestGroup(storeId uuid.UUID) services.SellerGroup {
	return services.SellerGroup{
		StoreId: storeId, SubtotalMinor: 30_000, Currency: "NGN",
		Lines: []services.PricedCartLine{{Quantity: 1, Product: commerceports.ProductSnapshot{ProductId: uuid.New(), StoreId: storeId, UnitPrice: money.Money{AmountMinor: 30_000, Currency: "NGN"}}}},
	}
}

func TestCheckoutKeepsHealthyStoresWhenACouponCannotBeUsed(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	now := time.Now()
	module.Container.Now = func() time.Time { return now }
	store := uuid.New()
	group := promotionTestGroup(store)

	_, discount, issue, err := services.ChoosePromotion(ctx, module.Container, uuid.New(), group, "DOES-NOT-EXIST")
	if err != nil {
		t.Fatal(err)
	}
	if discount != 0 || issue == nil || issue.Code != "COUPON_NOT_FOUND" {
		t.Fatalf("want a COUPON_NOT_FOUND issue without a discount, got discount=%d issue=%+v", discount, issue)
	}

	_, err = module.Container.Client.Promotion.Create().SetStoreID(store).SetName("Too small").SetKind("coupon").SetCode("TOOSMALL").SetDiscountKind("fixed").SetDiscountValue(1_000).
		SetMinimumSpendMinor(50_000).SetStartsAt(now.Add(-time.Hour)).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	_, discount, issue, err = services.ChoosePromotion(ctx, module.Container, uuid.New(), group, "TOOSMALL")
	if err != nil {
		t.Fatal(err)
	}
	if discount != 0 || issue == nil || issue.Code != "COUPON_NOT_APPLICABLE" {
		t.Fatalf("want a COUPON_NOT_APPLICABLE issue, got discount=%d issue=%+v", discount, issue)
	}

	automatic, err := module.Container.Client.Promotion.Create().SetStoreID(store).SetName("Automatic").SetKind("automatic").SetDiscountKind("fixed").SetDiscountValue(500).
		SetStartsAt(now.Add(-time.Hour)).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	chosen, discount, issue, err := services.ChoosePromotion(ctx, module.Container, uuid.New(), group, "DOES-NOT-EXIST")
	if err != nil {
		t.Fatal(err)
	}
	if chosen == nil || chosen.Id != automatic.ID || discount != 500 || issue == nil || issue.Code != "COUPON_NOT_FOUND" {
		t.Fatalf("want the automatic promotion plus a coupon issue, got chosen=%+v discount=%d issue=%+v", chosen, discount, issue)
	}

	valid, err := module.Container.Client.Promotion.Create().SetStoreID(store).SetName("Valid").SetKind("coupon").SetCode("VALID").SetDiscountKind("fixed").SetDiscountValue(1_500).
		SetStartsAt(now.Add(-time.Hour)).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	chosen, discount, issue, err = services.ChoosePromotion(ctx, module.Container, uuid.New(), group, "VALID")
	if err != nil {
		t.Fatal(err)
	}
	if chosen == nil || chosen.Id != valid.ID || discount != 1_500 || issue != nil {
		t.Fatalf("want the valid coupon without an issue, got chosen=%+v discount=%d issue=%+v", chosen, discount, issue)
	}
}
