package controllers

import (
	"testing"

	"nantty/modules/live/src/interfaces"
	"nantty/platform/httpserver"
)

func TestSpaceDonationAmountErrorExposesAuthoritativePolicy(t *testing.T) {
	apiError := spaceDonationError(&interfaces.DonationAmountPolicyError{MinimumCoins: 7, MaximumCoins: 250})
	converted, ok := apiError.(*httpserver.ApiError)
	if !ok {
		t.Fatalf("expected API error, got %T", apiError)
	}
	if converted.Status != 422 || converted.Code != "INVALID_DONATION_AMOUNT" || converted.Details["minimumCoins"] != int64(7) || converted.Details["maximumCoins"] != int64(250) {
		t.Fatalf("donation policy error response = %+v", converted)
	}
}
