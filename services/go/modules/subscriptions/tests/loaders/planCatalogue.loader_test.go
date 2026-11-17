package loaders_test

import (
	"testing"

	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/loaders"
)

func TestResolveAdminPlanCode(t *testing.T) {
	tests := []struct {
		name string
		key  string
		want string
	}{
		{name: "blue basic alias", key: "BLUE_BASIC", want: constants.PlanBlue},
		{name: "gold basic alias", key: "GOLD_BASIC", want: constants.PlanGoldOnly},
		{name: "black government alias", key: "BLACK_GOVERNMENT", want: constants.PlanBlack},
		{name: "legacy key remains readable", key: "seller_pro", want: constants.PlanSellerPro},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, ok := loaders.ResolveAdminPlanCode(test.key)
			if !ok || got != test.want {
				t.Fatalf("ResolveAdminPlanCode(%q) = (%q, %t), want (%q, true)", test.key, got, ok, test.want)
			}
		})
	}
}

func TestDefaultGoldPlanCatalogueMatchesApprovedLimits(t *testing.T) {
	plans := loaders.DefaultPlanCatalogue()
	tests := []struct {
		name          string
		planCode      string
		staff, places int64
	}{
		{name: "Gold Pro", planCode: constants.PlanSellerPro, staff: 5, places: 3},
		{name: "Gold Business", planCode: constants.PlanSellerBusiness, staff: 25, places: 10},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			entry, ok := plans[test.planCode]
			if !ok {
				t.Fatalf("missing plan %q", test.planCode)
			}
			limits := map[string]int64{}
			for _, entitlement := range entry.DashboardEntitlements {
				if entitlement.Limit != nil {
					limits[entitlement.Key] = *entitlement.Limit
				}
			}
			if limits["staffSeats"] != test.staff || limits["storeLocations"] != test.places {
				t.Fatalf("limits = %#v, want staff=%d locations=%d", limits, test.staff, test.places)
			}
		})
	}
}
