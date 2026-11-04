package validators

import (
	"testing"

	"nantty/modules/orders/src/modules/sellerOrders/dtos"
)

func TestValidateFulfilmentTrackingURLRequiresHttpsHostWithoutCredentials(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want bool
	}{
		{name: "valid hosted https link", url: "https://carrier.example/track/ABC123", want: true},
		{name: "rejects insecure scheme", url: "http://carrier.example/track/ABC123"},
		{name: "rejects missing host", url: "https:carrier.example/track/ABC123"},
		{name: "rejects credentials", url: "https://carrier.example@attacker.example/track/ABC123"},
		{name: "rejects empty host", url: "https:///track/ABC123"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			body := validFulfilmentRequest()
			body.TrackingUrl = &test.url
			err := ValidateFulfilment(body)
			if test.want && err != nil {
				t.Fatalf("expected valid tracking URL, got %v", err)
			}
			if !test.want && err == nil {
				t.Fatal("expected invalid tracking URL to be rejected")
			}
		})
	}
}

func validFulfilmentRequest() dtos.FulfilmentRequest {
	return dtos.FulfilmentRequest{
		Courier:        "Carrier",
		TrackingNumber: "ABCD-1234",
		FromLocationId: "0192f0a0-0000-7000-8000-000000000001",
	}
}
