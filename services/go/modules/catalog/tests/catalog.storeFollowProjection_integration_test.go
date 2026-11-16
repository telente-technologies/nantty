package catalog_test

import (
	"net/http"
	"testing"

	catalogerrors "nantty/modules/catalog/src/errors"
)

func TestStoreFollowProjectionFailurePropagatesFromDetailHandlers(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("followprojectionowner")
	shop := harness.store(ownerId, "Projection Unavailable Shop")
	product := harness.product(shop, "Projection Unavailable Product", 2500, true)
	harness.follows.err = catalogerrors.StoreFollowStatsUnavailable

	tests := []struct {
		name string
		path string
	}{
		{name: "store detail", path: "/api/v1/stores/" + shop.ID.String()},
		{name: "product detail", path: "/api/v1/products/" + product.ID.String()},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			status, body := harness.call(http.MethodGet, test.path, "", nil)
			if status != http.StatusServiceUnavailable || body["code"] != "STORE_FOLLOW_STATS_UNAVAILABLE" {
				t.Fatalf("GET %s = %d %v, want retryable store follow 503", test.path, status, body)
			}
		})
	}
}
