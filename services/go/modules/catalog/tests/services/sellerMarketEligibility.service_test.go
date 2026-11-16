package services_test

import (
	"errors"
	"testing"

	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/services"
)

func TestRequireNigeriaSellerMarket(t *testing.T) {
	for _, country := range []string{"NG", "ng", " NG "} {
		if err := services.RequireNigeriaSellerMarket(country); err != nil {
			t.Errorf("country %q should be eligible: %v", country, err)
		}
	}
	for _, country := range []string{"", "GH", "GB", "US"} {
		if err := services.RequireNigeriaSellerMarket(country); !errors.Is(err, catalogerrors.SellerMarketUnavailable) {
			t.Errorf("country %q should be rejected as seller market: %v", country, err)
		}
	}
}
