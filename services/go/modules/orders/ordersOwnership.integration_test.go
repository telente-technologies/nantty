package orders

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/databases/schema"
	ordererrors "zudomart/modules/orders/src/errors"
	getmyorder "zudomart/modules/orders/src/modules/orders/queries/getMyOrder"
)

func TestAnotherBuyersOrderLooksExactlyLikeAMissingOrder(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	owner, stranger := uuid.New(), uuid.New()
	group, err := module.Container.Client.OrderGroup.Create().
		SetCheckoutID(uuid.New()).SetReference("ZM-OWN-0001").SetInvoiceNumber("INV-OWN-0001").SetStoreID(uuid.New()).SetSellerAccountID(uuid.New()).
		SetBuyerAccountID(owner).SetCurrency("NGN").SetSubtotalMinor(100_00).SetShippingMinor(0).SetTotalMinor(100_00).
		SetAddress(schema.AddressSnapshot{RecipientName: "Ada", Phone: "+2348000000000", Line1: "1 Marina", CountryCode: "NG"}).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	handler := getmyorder.Handler{Container: module.Container}
	if _, err := handler.Execute(ctx, getmyorder.Query{BuyerId: owner, OrderId: group.ID}); errors.Is(err, ordererrors.OrderNotFound) {
		t.Fatal("the owner must find their own order")
	}
	_, otherBuyersOrder := handler.Execute(ctx, getmyorder.Query{BuyerId: stranger, OrderId: group.ID})
	_, missingOrder := handler.Execute(ctx, getmyorder.Query{BuyerId: stranger, OrderId: uuid.New()})
	if !errors.Is(otherBuyersOrder, ordererrors.OrderNotFound) || !errors.Is(missingOrder, ordererrors.OrderNotFound) {
		t.Fatalf("want the same 404 for both, got %v and %v", otherBuyersOrder, missingOrder)
	}
}
