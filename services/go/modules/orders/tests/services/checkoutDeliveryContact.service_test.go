package services_test

import (
	"testing"

	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/services"
)

func TestCheckoutRequiresBuyerDeliveryPhone(t *testing.T) {
	for _, phone := range []string{"", "  \t", "buyer@example.com", "08012345678", "+23412", "+234 803 441 7720 ext 4"} {
		if _, err := services.NormalizeCheckoutDeliveryPhone(phone); err != ordererrors.AddressPhoneRequired {
			t.Errorf("phone %q: got %v, want ADDRESS_PHONE_REQUIRED", phone, err)
		}
	}
	for input, expected := range map[string]string{
		"+2348034417720":        "+2348034417720",
		" +234 (803) 441-7720 ": "+2348034417720",
	} {
		if got, err := services.NormalizeCheckoutDeliveryPhone(input); err != nil || got != expected {
			t.Errorf("NormalizeCheckoutDeliveryPhone(%q) = %q, %v; want %q, nil", input, got, err, expected)
		}
	}
}
