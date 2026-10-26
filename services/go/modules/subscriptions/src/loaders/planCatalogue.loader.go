package loaders

import (
	"context"
	"encoding/json"
	"strings"

	ledgerloaders "nantty/modules/ledger/src/loaders"
	"nantty/modules/subscriptions/src/constants"
)

const PlansSettingKey = "plans"

type DashboardEntitlement struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Limit *int64 `json:"limit"`
}

type PlanPerk struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type PlanCatalogueEntry struct {
	PlanCode              string                 `json:"planCode"`
	DisplayName           string                 `json:"displayName"`
	IsPurchasable         bool                   `json:"isPurchasable"`
	Perks                 []PlanPerk             `json:"perks"`
	DashboardEntitlements []DashboardEntitlement `json:"dashboardEntitlements"`
}

var adminPlanKeys = map[string]string{
	"BLUE_ESSENTIAL": constants.PlanBlueEssential, "BLUE_VERIFIED": constants.PlanBlue, "BLUE_PREMIUM": constants.PlanPremium,
	"GOLD_ONLY": constants.PlanGoldOnly, "GOLD_PRO": constants.PlanSellerPro, "GOLD_BUSINESS": constants.PlanSellerBusiness, "GOLD_PREMIUM": constants.PlanSellerBusiness,
	"GOLD_COMBINED":  constants.PlanGoldCombined,
	"BLACK_OFFICIAL": constants.PlanBlack,
}

func limit(value int64) *int64 { return &value }

func goldEntitlements(staff, locations, catalogImport int64) []DashboardEntitlement {
	return []DashboardEntitlement{
		{Key: "staffSeats", Label: "Staff seats", Limit: limit(staff)},
		{Key: "storeLocations", Label: "Store locations", Limit: limit(locations)},
		{Key: "advancedReports", Label: "Advanced sales reports and exports"},
		{Key: "catalogImport", Label: "Bulk catalog import (CSV)", Limit: limit(catalogImport)},
	}
}

func DefaultPlanCatalogue() map[string]PlanCatalogueEntry {
	perks := func(titles ...string) []PlanPerk {
		converted := make([]PlanPerk, 0, len(titles))
		for _, title := range titles {
			converted = append(converted, PlanPerk{Title: title})
		}
		return converted
	}
	return map[string]PlanCatalogueEntry{
		constants.PlanBlueEssential: {DisplayName: "Blue Essential", IsPurchasable: true, Perks: perks("Priority account recovery", "Impersonation protection", "Edit posts within 1 hour", "Fewer ads")},
		constants.PlanBlue:          {DisplayName: "Blue Verified", IsPurchasable: true, Perks: perks("Blue badge on profile and posts", "Priority ranking in comments", "Longer clips (up to 10 minutes)", "Fewer ads")},
		constants.PlanPremium: {DisplayName: "Blue Premium", IsPurchasable: true, Perks: perks("Everything in Blue Verified", "No ads anywhere", "Monthly boost credit", "Priority support",
			"Up to 5 business profiles", "One Gold plan for all your businesses, up to 16% off")},
		constants.PlanGoldCombined: {DisplayName: "Gold for all your businesses", IsPurchasable: true,
			Perks: perks("Gold business badge on every business you choose", "One bill for up to 5 businesses", "Up to 16% off monthly, plus 5% more yearly")},
		constants.PlanGoldOnly: {DisplayName: "Gold", IsPurchasable: true, Perks: perks("Gold business badge", "Verified store label on products", "Fewer ads")},
		constants.PlanSellerPro: {DisplayName: "Gold Pro", IsPurchasable: true, Perks: perks("Gold business badge", "Zudomart Dashboard access", "Verified store label on products", "Fewer ads"),
			DashboardEntitlements: goldEntitlements(3, 1, 2_000)},
		constants.PlanSellerBusiness: {DisplayName: "Gold Business", IsPurchasable: true, Perks: perks("Everything in Gold Pro", "Dedicated account manager", "Lower escrow fee", "No ads anywhere"),
			DashboardEntitlements: goldEntitlements(15, 10, 20_000)},
		constants.PlanBlack: {DisplayName: "Black Official", Perks: perks("Government and public institution badge", "Very few ads")},
	}
}

func planCodeForKey(key string) (string, bool) {
	if code, known := adminPlanKeys[strings.ToUpper(key)]; known {
		return code, true
	}
	_, known := constants.Plans[key]
	return key, known
}

func ReadPlanCatalogue(ctx context.Context, source *ledgerloaders.PlatformSettingsSource) map[string]PlanCatalogueEntry {
	catalogue := DefaultPlanCatalogue()
	for code, entry := range catalogue {
		entry.PlanCode = code
		catalogue[code] = entry
	}
	if source == nil {
		return catalogue
	}
	raw, found := source.ReadValue(ctx, PlansSettingKey)
	if !found {
		return catalogue
	}
	var stored struct {
		Plans []struct {
			PlanKey               string                 `json:"planKey"`
			DisplayName           string                 `json:"displayName"`
			IsPurchasable         *bool                  `json:"isPurchasable"`
			Perks                 []string               `json:"perks"`
			DashboardEntitlements []DashboardEntitlement `json:"dashboardEntitlements"`
		} `json:"plans"`
	}
	if json.Unmarshal(raw, &stored) != nil {
		return catalogue
	}
	for _, plan := range stored.Plans {
		code, known := planCodeForKey(plan.PlanKey)
		if !known {
			continue
		}
		entry := catalogue[code]
		if plan.DisplayName != "" {
			entry.DisplayName = plan.DisplayName
		}
		if plan.IsPurchasable != nil {
			entry.IsPurchasable = *plan.IsPurchasable && code != constants.PlanBlack
		}
		if plan.Perks != nil {
			entry.Perks = make([]PlanPerk, 0, len(plan.Perks))
			for _, perk := range plan.Perks {
				if title := strings.TrimSpace(perk); title != "" && len(entry.Perks) < 20 {
					entry.Perks = append(entry.Perks, PlanPerk{Title: title})
				}
			}
		}
		if plan.DashboardEntitlements != nil {
			entry.DashboardEntitlements = plan.DashboardEntitlements
		}
		catalogue[code] = entry
	}
	return catalogue
}
