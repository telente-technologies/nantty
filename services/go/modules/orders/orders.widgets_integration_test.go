package orders

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	src "nantty/modules/orders/src"
	"nantty/modules/orders/src/databases/schema"
	getsellertoday "nantty/modules/orders/src/modules/widgets/queries/getSellerToday"
	listactiveorders "nantty/modules/orders/src/modules/widgets/queries/listActiveOrders"
	"nantty/platform/commerceports"
)

func seedWidgetOrder(t *testing.T, module *src.Module, store, buyer uuid.UUID, reference, status, paymentStatus string, rider *string) uuid.UUID {
	t.Helper()
	create := module.Container.Client.OrderGroup.Create().SetCheckoutID(uuid.New()).SetReference(reference).SetInvoiceNumber("INV-" + reference).
		SetStoreID(store).SetSellerAccountID(uuid.New()).SetBuyerAccountID(buyer).SetBuyerName("Ada").SetBuyerUsername("ada").SetPaymentStatus(paymentStatus).SetStatus(status).
		SetCurrency("NGN").SetSubtotalMinor(150_000).SetShippingMinor(0).SetTotalMinor(150_000).SetEstimatedDeliveryAt(time.Now().Add(6 * time.Hour)).
		SetAddress(schema.AddressSnapshot{RecipientName: "Ada", Phone: "+2348011111111", Line1: "1 Marina", CountryCode: "NG", CityName: "Ikeja"})
	if rider != nil {
		create.SetRiderName(*rider)
	}
	group, err := create.Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return group.ID
}

func TestOrderWidgetShowsOnlyTheBuyersActiveOrders(t *testing.T) {
	module := startAgainstFreshSchema(t)
	store, buyer, otherBuyer := uuid.New(), uuid.New(), uuid.New()
	outForDelivery := seedWidgetOrder(t, module, store, buyer, "ZM-WGT-0001", "shipped", "paid", pointerTo("Tunde"))
	seedWidgetOrder(t, module, store, buyer, "ZM-WGT-0002", "processing", "paid", nil)
	seedWidgetOrder(t, module, store, buyer, "ZM-WGT-0003", "completed", "paid", nil)
	seedWidgetOrder(t, module, store, buyer, "ZM-WGT-0004", "pending", "pending", nil)
	seedWidgetOrder(t, module, store, otherBuyer, "ZM-WGT-0005", "shipped", "paid", nil)

	payload, err := listactiveorders.Handler{Container: module.Container}.Execute(context.Background(), listactiveorders.Query{BuyerId: buyer, Limit: 3})
	if err != nil {
		t.Fatal(err)
	}
	if payload.ActiveCount != 2 || len(payload.Orders) != 2 {
		t.Fatalf("expected the two active orders only, got %+v", payload)
	}
	statuses := map[string]string{}
	for _, order := range payload.Orders {
		statuses[order.Id] = order.Status
		if order.EtaAt == nil || order.DeepLink != "nantty://orders/"+order.Id {
			t.Fatalf("missing eta or deep link: %+v", order)
		}
	}
	if statuses[outForDelivery.String()] != "out_for_delivery" {
		t.Fatalf("a shipped order with a rider is out for delivery: %v", statuses)
	}
}

func TestSellerTodayWidgetCountsTodayAndHidesAmountsOnRequest(t *testing.T) {
	module := startAgainstFreshSchema(t)
	storeId := uuid.New()
	for index, status := range []string{"new", "ready", "completed", "cancelled"} {
		seedWidgetOrder(t, module, storeId, uuid.New(), "ZM-SLT-000"+string(rune('1'+index)), status, "paid", nil)
	}
	seedWidgetOrder(t, module, storeId, uuid.New(), "ZM-SLT-0009", "pending", "pending", nil)
	store := commerceports.StoreAccess{StoreId: storeId, Currency: "NGN", Role: "owner", StoreName: "Ada Fabrics", Timezone: "Africa/Lagos"}
	handler := getsellertoday.Handler{Container: module.Container}
	shown, err := handler.Execute(context.Background(), getsellertoday.Query{Store: store, ActorId: uuid.New()})
	if err != nil {
		t.Fatal(err)
	}
	if shown.OrdersToShip != 2 || shown.OrdersToday != 3 || shown.SalesToday == nil || shown.SalesToday.AmountMinor != 450_000 || shown.StoreName != "Ada Fabrics" {
		t.Fatalf("unexpected seller summary %+v sales=%v", shown, shown.SalesToday)
	}
	hidden, err := handler.Execute(context.Background(), getsellertoday.Query{Store: store, ActorId: uuid.New(), AmountsHidden: true})
	if err != nil || hidden.SalesToday != nil || hidden.AvailableBalance != nil || !hidden.AmountsHidden || hidden.OrdersToShip != 2 {
		t.Fatalf("hidden amounts must not be computed or returned: %+v %v", hidden, err)
	}
	if balance := getsellertoday.ParseAvailableBalance([]byte(`{"available":{"amountMinor":5000,"currency":"NGN"}}`)); balance == nil || balance.AmountMinor != 5000 {
		t.Fatalf("balance parse: %v", balance)
	}
	if getsellertoday.ParseAvailableBalance([]byte(`null`)) != nil {
		t.Fatal("missing balances stay null")
	}
}
