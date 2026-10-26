package loaders

import (
	"testing"

	"nantty/modules/ads/src/configs"
	"nantty/modules/ads/src/integrations"
)

func TestTheInMemoryFundingFakeIsRefusedInProductionOnly(t *testing.T) {
	fake := integrations.NewInMemoryFundingGateway()
	if refuseFakeFundingInProduction(fake, configs.AdsSettings{Environment: "production"}) == nil {
		t.Fatal("production must refuse the fake")
	}
	if refuseFakeFundingInProduction(fake, configs.AdsSettings{Environment: "development"}) != nil {
		t.Fatal("development may use the fake")
	}
	if refuseFakeFundingInProduction(integrations.UnconfiguredFundingGateway{}, configs.AdsSettings{Environment: "production"}) != nil {
		t.Fatal("the unconfigured gateway is safe: it refuses every charge")
	}
}
