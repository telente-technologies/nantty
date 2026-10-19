package constants

import "slices"

const GeneralAdCategory = "general"

var AdCategories = []string{
	GeneralAdCategory, "alcohol", "gambling", "dating", "weight_loss_cosmetic", "tobacco_vaping", "adult_products", "financial_speculation",
}

var ageRestrictedAdCategories = []string{
	"alcohol", "gambling", "dating", "weight_loss_cosmetic", "tobacco_vaping", "adult_products", "financial_speculation",
}

var ageRestrictedPolicyFlags = []string{
	"alcohol", "gambling", "dating", "weight_loss_cosmetic", "tobacco_vaping", "adult_content", "adult_products", "financial_speculation", "financial_scams",
}

func IsKnownAdCategory(category string) bool {
	return slices.Contains(AdCategories, category)
}

func IsAgeRestrictedAdCategory(category string) bool {
	return slices.Contains(ageRestrictedAdCategories, category)
}

func IsAgeRestrictedPolicyFlag(policyCategoryId string) bool {
	return slices.Contains(ageRestrictedPolicyFlags, policyCategoryId)
}
