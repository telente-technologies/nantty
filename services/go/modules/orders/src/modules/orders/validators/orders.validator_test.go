package validators

import (
	"testing"

	"nantty/modules/orders/src/modules/orders/dtos"
)

const validStoreId = "0192f0a0-0000-7000-8000-000000000001"
const validQuoteRevision = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

func checkoutWithModes(modes ...dtos.PaymentModeChoice) dtos.CheckoutRequest {
	return dtos.CheckoutRequest{AddressId: validStoreId, ShippingQuoteRevision: validQuoteRevision, PaymentModes: modes}
}

func TestValidateCheckoutRequiresAcceptanceForDirectPayment(t *testing.T) {
	body := checkoutWithModes(dtos.PaymentModeChoice{StoreId: validStoreId, Mode: "direct"})
	if err := ValidateCheckout(body); err == nil {
		t.Fatal("direct payment without acceptance must be rejected")
	}
	body.DirectPaymentAccepted = true
	if err := ValidateCheckout(body); err != nil {
		t.Fatal(err)
	}
}

func TestValidateCheckoutRequiresShippingQuoteRevision(t *testing.T) {
	body := checkoutWithModes()
	body.ShippingQuoteRevision = ""
	if err := ValidateCheckout(body); err == nil {
		t.Fatal("checkout without the reviewed shipping quote revision must be rejected")
	}
	body.ShippingQuoteRevision = "not-a-sha256-revision"
	if err := ValidateCheckout(body); err == nil {
		t.Fatal("checkout with a malformed shipping quote revision must be rejected")
	}
}

func TestValidateCheckoutDoesNotRequireAcceptanceForEscrow(t *testing.T) {
	body := checkoutWithModes(dtos.PaymentModeChoice{StoreId: validStoreId, Mode: "escrow"})
	if err := ValidateCheckout(body); err != nil {
		t.Fatal(err)
	}
}
