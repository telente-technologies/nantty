package services

import (
	"zudomart/modules/ads/src/constants"
	"zudomart/modules/ads/src/generated/ent"
)

func EffectiveAdCategory(row *ent.Ad, campaign *ent.AdCampaign) string {
	if row.AdCategory != "" {
		return row.AdCategory
	}
	if campaign != nil && campaign.AdCategory != "" {
		return campaign.AdCategory
	}
	return constants.GeneralAdCategory
}

func IsAgeRestrictedAd(row *ent.Ad, campaign *ent.AdCampaign) bool {
	if constants.IsAgeRestrictedAdCategory(EffectiveAdCategory(row, campaign)) {
		return true
	}
	for _, flag := range row.AutoCheckFlags {
		if constants.IsAgeRestrictedPolicyFlag(flag.PolicyCategoryId) {
			return true
		}
	}
	return false
}
