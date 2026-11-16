package validators_test

import (
	"testing"
	"time"

	"nantty/modules/catalog/src/modules/sellerProducts/dtos"
	"nantty/modules/catalog/src/modules/sellerProducts/validators"
)

func TestRegionalPricesAreOptionalAndValidated(t *testing.T) {
	request := validRequest()
	request.Variants[0].RegionalPrices = []dtos.RegionalPriceRequest{{Currency: "GHS", PriceMinor: 9000}, {Currency: "USD", PriceMinor: 700}}
	if err := validators.ValidateProductUpsertAt(request, time.Now()); err != nil {
		t.Fatalf("valid regional prices must pass: %v", err)
	}
	compare := int64(100)
	cases := map[string][]dtos.RegionalPriceRequest{
		"unsupported currency": {{Currency: "JPY", PriceMinor: 100}},
		"duplicate currency":   {{Currency: "GHS", PriceMinor: 100}, {Currency: "GHS", PriceMinor: 200}},
		"zero price":           {{Currency: "GHS", PriceMinor: 0}},
		"compare below price":  {{Currency: "GHS", PriceMinor: 500, CompareAtPriceMinor: &compare}},
	}
	for name, prices := range cases {
		broken := validRequest()
		broken.Variants[0].RegionalPrices = prices
		if err := validators.ValidateProductUpsertAt(broken, time.Now()); err == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
}
