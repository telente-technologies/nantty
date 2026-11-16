package services_test

import (
	"testing"

	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/payments/src/modules/gateway/services"
)

func TestCheckoutPayablesRequirePositiveAmountsAndOneValidCurrency(t *testing.T) {
	base := models.OrderPayable{CheckoutId: "checkout", BuyerUserId: "buyer", OrderId: "order", AmountMinor: 100, Currency: "NGN"}
	if err := services.ValidateCheckoutPayableMoney([]models.OrderPayable{base}); err != nil {
		t.Fatalf("valid payable: %v", err)
	}
	cases := []struct {
		name string
		edit func([]models.OrderPayable) []models.OrderPayable
	}{
		{name: "zero amount", edit: func(rows []models.OrderPayable) []models.OrderPayable { rows[0].AmountMinor = 0; return rows }},
		{name: "negative amount", edit: func(rows []models.OrderPayable) []models.OrderPayable { rows[0].AmountMinor = -1; return rows }},
		{name: "lowercase currency", edit: func(rows []models.OrderPayable) []models.OrderPayable { rows[0].Currency = "ngn"; return rows }},
		{name: "malformed currency", edit: func(rows []models.OrderPayable) []models.OrderPayable { rows[0].Currency = "N1N"; return rows }},
		{name: "currency mismatch", edit: func(rows []models.OrderPayable) []models.OrderPayable {
			second := rows[0]
			second.OrderId, second.Currency = "order-2", "USD"
			return append(rows, second)
		}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			rows := test.edit([]models.OrderPayable{base})
			if err := services.ValidateCheckoutPayableMoney(rows); err == nil {
				t.Fatal("invalid payable money must be rejected")
			}
		})
	}
}
