package orders

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/services"
)

func TestPerCustomerCouponLimitHoldsUnderConcurrentCheckouts(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	store := uuid.New()
	limit := 1
	coupon, err := module.Container.Client.Promotion.Create().SetStoreID(store).SetName("Once each").SetKind("coupon").SetCode("ONCE").SetDiscountKind("fixed").SetDiscountValue(1_000).
		SetUsageLimitPerCustomer(limit).SetStartsAt(time.Now().Add(-time.Hour)).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	rule := services.RuleOf(coupon)
	buyer := uuid.New()
	groups := make([]*ent.OrderGroup, 4)
	for index := range groups {
		group, err := module.Container.Client.OrderGroup.Create().
			SetCheckoutID(uuid.New()).SetReference("ZM-CP-" + uuid.NewString()[:6]).SetInvoiceNumber("INV-" + uuid.NewString()[:8]).SetStoreID(store).SetSellerAccountID(uuid.New()).
			SetBuyerAccountID(buyer).SetCurrency("NGN").SetSubtotalMinor(30_000).SetShippingMinor(0).SetTotalMinor(30_000).SetStatus("pending").SetPaymentStatus("pending").
			SetPaymentMode("escrow").SetAddress(schema.AddressSnapshot{RecipientName: "Ada", Phone: "+2348000000000", Line1: "1 Marina", CountryCode: "NG"}).Save(ctx)
		if err != nil {
			t.Fatal(err)
		}
		groups[index] = group
	}
	var waitGroup sync.WaitGroup
	results := make([]error, len(groups))
	start := make(chan struct{})
	for index, group := range groups {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			results[index] = module.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
				return services.RedeemPromotionInTransaction(ctx, tx, group, services.PlannedGroup{Promotion: &rule, DiscountMinor: 1_000})
			})
		}()
	}
	close(start)
	waitGroup.Wait()
	succeeded := 0
	for _, result := range results {
		if result == nil {
			succeeded++
		}
	}
	redemptions := module.Container.Client.PromotionRedemption.Query().CountX(ctx)
	if succeeded != 1 || redemptions != 1 {
		t.Fatalf("a once-per-customer coupon was redeemed %d times (%d rows): %v", succeeded, redemptions, results)
	}
}
