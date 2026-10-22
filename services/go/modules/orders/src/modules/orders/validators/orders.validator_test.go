package validators

import (
	"testing"

	"zudomart/modules/orders/src/modules/orders/dtos"
)

const validStoreId = "0192f0a0-0000-7000-8000-000000000001"

func checkoutWithModes(modes ...dtos.PaymentModeChoice) dtos.CheckoutRequest {
	return dtos.CheckoutRequest{AddressId: validStoreId, PaymentModes: modes}
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

func TestValidateCheckoutDoesNotRequireAcceptanceForEscrow(t *testing.T) {
	body := checkoutWithModes(dtos.PaymentModeChoice{StoreId: validStoreId, Mode: "escrow"})
	if err := ValidateCheckout(body); err != nil {
		t.Fatal(err)
	}
}
