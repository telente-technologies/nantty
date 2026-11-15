package ads_test

import (
	"net/http"
	"testing"
)

func TestRegionalPricingAndEstimatesNeedASignedInAdvertiser(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	h.expect("GET", "/api/v1/ads/pricing?countries=NG&currency=NGN", nil, "", nil, http.StatusUnauthorized)
	h.expect("POST", "/api/v1/ads/pricing/estimate", nil, "", map[string]any{}, http.StatusUnauthorized)
	advertiser := h.newUser("pricingreader")
	h.expect("GET", "/api/v1/ads/pricing?countries=NG&currency=NGN", &advertiser, "", nil, http.StatusOK)
}
