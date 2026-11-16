package loaders_test

import (
	"testing"

	"nantty/modules/ads/src/configs"
	"nantty/modules/ads/src/integrations"
	"nantty/modules/ads/src/loaders"
)

func TestTheInMemoryFundingFakeIsRefusedInProductionOnly(t *testing.T) {
	fake := integrations.NewInMemoryFundingGateway()
	if loaders.ValidateFundingGatewayForEnvironment(fake, configs.AdsSettings{Environment: "production"}) == nil {
		t.Fatal("production must refuse the fake")
	}
	if loaders.ValidateFundingGatewayForEnvironment(fake, configs.AdsSettings{Environment: "development"}) != nil {
		t.Fatal("development may use the fake")
	}
	if loaders.ValidateFundingGatewayForEnvironment(integrations.UnconfiguredFundingGateway{}, configs.AdsSettings{Environment: "production"}) != nil {
		t.Fatal("the unconfigured gateway is safe: it refuses every charge")
	}
}
