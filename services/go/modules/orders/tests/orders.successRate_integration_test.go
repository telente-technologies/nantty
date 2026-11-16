package orders_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src"
	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/services"
)

type seededGroup struct {
	status, payment string
	refunded        int64
	age             time.Duration
}

func seedOrderGroups(t *testing.T, module *src.Module, storeId uuid.UUID, groups []seededGroup) {
	t.Helper()
	ctx := context.Background()
	now := module.Container.Now()
	for index, group := range groups {
		reference := fmt.Sprintf("R%d", time.Now().UnixNano()%1_000_000_000_000+int64(index))
		err := module.Container.Client.OrderGroup.Create().SetCheckoutID(uuid.New()).SetReference(reference).SetInvoiceNumber(reference).
			SetStoreID(storeId).SetSellerAccountID(uuid.New()).SetBuyerAccountID(uuid.New()).SetStatus(group.status).SetPaymentStatus(group.payment).
			SetCurrency("NGN").SetSubtotalMinor(10_000).SetShippingMinor(0).SetTotalMinor(10_000).SetRefundedMinor(group.refunded).
			SetAddress(schema.AddressSnapshot{}).SetCreatedAt(now.Add(-group.age)).Exec(ctx)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func repeatGroup(group seededGroup, count int) []seededGroup {
	groups := make([]seededGroup, count)
	for index := range groups {
		groups[index] = group
	}
	return groups
}

func TestStoreSuccessRollupCountsSettledOrdersInTheWindowAndDropsStaleStores(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	day := 24 * time.Hour
	ranked, small := uuid.New(), uuid.New()
	groups := repeatGroup(seededGroup{status: enums.StatusCompleted, payment: enums.PaymentPaid, age: day}, 17)
	groups = append(groups,
		seededGroup{status: enums.StatusCompleted, payment: enums.PaymentPaid, refunded: 2_000, age: day},
		seededGroup{status: enums.StatusRefunded, payment: enums.PaymentRefunded, refunded: 10_000, age: day},
		seededGroup{status: enums.StatusCancelled, payment: enums.PaymentRefunded, refunded: 10_000, age: day},
		seededGroup{status: enums.StatusCancelled, payment: enums.PaymentPending, age: day},
		seededGroup{status: enums.StatusCompleted, payment: enums.PaymentPaid, age: 120 * day},
		seededGroup{status: enums.StatusShipped, payment: enums.PaymentPaid, age: day},
	)
	seedOrderGroups(t, module, ranked, groups)
	seedOrderGroups(t, module, small, repeatGroup(seededGroup{status: enums.StatusCompleted, payment: enums.PaymentPaid, age: day}, 5))

	if err := services.RefreshStoreSuccessStats(ctx, module.Container); err != nil {
		t.Fatal(err)
	}
	rates, err := services.StoreSuccessRates(ctx, module.Container, []uuid.UUID{ranked, small})
	if err != nil {
		t.Fatal(err)
	}
	if rate, ok := rates[ranked]; !ok || rate != 0.85 {
		t.Fatalf("17 clean completions out of 20 settled orders in the window is 0.85, got %v (present=%v)", rate, ok)
	}
	if _, ok := rates[small]; ok {
		t.Fatal("a store under the minimum order count has no rate")
	}

	later := module.Container.Now().Add(time.Second)
	module.Container.Now = func() time.Time { return later }
	if _, err := module.Container.Client.OrderGroup.Delete().Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := services.RefreshStoreSuccessStats(ctx, module.Container); err != nil {
		t.Fatal(err)
	}
	if left, err := module.Container.Client.StoreSuccessStat.Query().Count(ctx); err != nil || left != 0 {
		t.Fatalf("stores without recent orders drop out of the rollup: %d rows, err %v", left, err)
	}
}
