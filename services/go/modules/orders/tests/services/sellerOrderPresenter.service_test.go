package services_test

import (
	"testing"

	"github.com/google/uuid"
	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/services"
)

func TestSellerOrderViewIncludesBuyerDeliveryAddressDetails(t *testing.T) {
	group := &ent.OrderGroup{
		ID: uuid.New(), CheckoutID: uuid.New(), BuyerAccountID: uuid.New(), StoreID: uuid.New(), SellerAccountID: uuid.New(),
		Currency: "NGN", Address: schema.AddressSnapshot{RecipientName: "Buyer", Phone: "+2348000000000", Line1: "1 Market Road", Line2: "Flat 4B", PostalCode: "100001", Details: "Use the side gate", CityName: "Lagos", RegionName: "Lagos", CountryCode: "NG"},
	}
	view := services.BuildSellerOrderView(group, nil, nil, nil)
	address := view.ShippingAddress
	if address.Line2 != "Flat 4B" || address.PostalCode != "100001" || address.Details != "Use the side gate" {
		t.Fatalf("seller fulfillment view lost buyer-provided delivery details: %+v", address)
	}
}
