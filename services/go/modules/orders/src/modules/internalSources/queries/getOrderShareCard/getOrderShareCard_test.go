package getordersharecard

import "testing"

func TestPresentShowsOnlyAMinimalOrderSummary(t *testing.T) {
	image := "https://cdn.example/dress.webp"
	card := Present(ShareCard{OrderId: "o1", StoreId: "s1", OrderNumber: "ZM-1042", Status: "shipped", ItemCount: 3, Total: Money{AmountMinor: 1234550, Currency: "NGN"}, ImageUrl: &image})
	if card.Availability != "available" || card.Title != "Order ZM-1042" || card.Subtitle != "3 items · shipped" || card.PriceLabel != "NGN 12,345.50" || card.ImageUrl != &image {
		t.Fatalf("unexpected card %+v", card)
	}
	if single := Present(ShareCard{OrderNumber: "ZM-1", Status: "in_transit", ItemCount: 1, Total: Money{AmountMinor: 500, Currency: "NGN"}}); single.Subtitle != "1 item · in transit" || single.PriceLabel != "NGN 5.00" {
		t.Fatalf("unexpected single card %+v", single)
	}
}
