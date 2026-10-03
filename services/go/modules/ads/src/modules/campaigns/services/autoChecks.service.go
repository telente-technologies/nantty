package services

import (
	"strings"

	"zudomart/modules/ads/src/types"
)

type policyKeywordRule struct {
	code     string
	label    string
	severity string
	keywords []string
}

var policyKeywordRules = []policyKeywordRule{
	{"financial_scams", "Deceptive financial offer", "CRITICAL", []string{"double your money", "guaranteed returns", "get rich quick", "ponzi"}},
	{"misleading_claims", "Miracle or misleading claim", "HIGH", []string{"cures diabetes", "miracle cure", "lose 10kg in", "100% guaranteed"}},
	{"counterfeit", "Possible counterfeit goods", "HIGH", []string{"first copy", "replica", "aaa quality", "master copy"}},
	{"weapons", "Weapons", "CRITICAL", []string{"firearm", "ammunition", "pistol for sale"}},
	{"tobacco_vaping", "Tobacco and vaping", "HIGH", []string{"vape", "shisha", "e-cigarette"}},
	{"adult_content", "Adult content", "CRITICAL", []string{"escort", "nude", "xxx"}},
	{"gambling", "Gambling", "MEDIUM", []string{"betting", "casino", "jackpot"}},
}

func RunAutomatedPolicyChecks(input types.CreativeInput) []types.AutoCheckFlag {
	text := strings.ToLower(input.Headline + " " + input.PrimaryText)
	flags := []types.AutoCheckFlag{}
	for _, rule := range policyKeywordRules {
		for _, keyword := range rule.keywords {
			if strings.Contains(text, keyword) {
				flags = append(flags, types.AutoCheckFlag{PolicyCategoryId: rule.code, Label: rule.label, Severity: rule.severity, Detail: "Matched \"" + keyword + "\" in the ad text."})
				break
			}
		}
	}
	return flags
}

func HasCriticalFlag(flags []types.AutoCheckFlag) bool {
	for _, flag := range flags {
		if flag.Severity == "CRITICAL" {
			return true
		}
	}
	return false
}
