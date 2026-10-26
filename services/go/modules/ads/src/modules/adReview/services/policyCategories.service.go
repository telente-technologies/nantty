package services

import (
	"context"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adpolicycategory"
	"nantty/modules/ads/src/modules/adReview/dtos"
)

func PresentPolicyCategory(row *ent.AdPolicyCategory) dtos.PolicyCategory {
	return dtos.PolicyCategory{Id: row.ID.String(), Name: row.Name, Description: row.Description, Severity: string(row.Severity), IsActive: row.IsActive, RejectionCount: row.RejectionCount}
}

type seedCategory struct{ code, name, description, severity string }

var seedCategories = []seedCategory{
	{"illegal_products", "Illegal products and services", "Anything illegal in the country where the ad is shown.", "CRITICAL"},
	{"weapons", "Weapons and explosives", "Firearms, ammunition, explosives and parts for them.", "CRITICAL"},
	{"tobacco_vaping", "Tobacco, vaping and recreational drugs", "Cigarettes, vapes, shisha and drug paraphernalia.", "HIGH"},
	{"adult_content", "Adult content and services", "Nudity, sexual services and suggestive imagery.", "CRITICAL"},
	{"financial_scams", "Deceptive financial products", "Get-rich-quick offers, ponzi schemes and unregistered investments.", "CRITICAL"},
	{"counterfeit", "Counterfeit goods", "Replicas or fakes of branded products.", "HIGH"},
	{"misleading_claims", "Misleading claims", "Miracle cures, fake scarcity or fake reviews.", "HIGH"},
	{"gambling", "Gambling without authorisation", "Betting, lotteries and casinos need written approval and a valid licence.", "MEDIUM"},
	{"discrimination", "Discrimination and hate", "Ads that target or exclude people by protected traits in a harmful way.", "HIGH"},
	{"personal_attributes", "Personal attributes", "Text that implies you know someone's private traits.", "MEDIUM"},
}

func SeedDefaultPolicyCategoriesWhenMissing(ctx context.Context, client *ent.Client) error {
	for _, category := range seedCategories {
		exists, err := client.AdPolicyCategory.Query().Where(adpolicycategory.Code(category.code)).Exist(ctx)
		if err != nil || exists {
			if err != nil {
				return err
			}
			continue
		}
		if err := client.AdPolicyCategory.Create().SetCode(category.code).SetName(category.name).SetDescription(category.description).SetSeverity(adpolicycategory.Severity(category.severity)).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}
