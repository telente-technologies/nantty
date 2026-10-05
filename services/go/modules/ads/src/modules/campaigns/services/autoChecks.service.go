package services

import (
	"strings"
	"sync/atomic"

	adsservices "zudomart/modules/ads/src/services"
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

var blockedDestinationDomains atomic.Pointer[[]string]

func ConfigureBlockedDomains(domains []string) { blockedDestinationDomains.Store(&domains) }

func creativeText(input types.CreativeInput) string {
	text := input.Headline + " " + input.PrimaryText
	for _, card := range input.Cards {
		text += " " + card.Headline + " " + card.Description
	}
	if input.App != nil {
		text += " " + input.App.AppName
	}
	return strings.ToLower(text)
}

func destinationUrls(input types.CreativeInput) []string {
	urls := []string{}
	add := func(destination types.CreativeDestination) {
		if destination.Url != nil {
			urls = append(urls, *destination.Url)
		}
	}
	add(input.Destination)
	for _, card := range input.Cards {
		add(card.Destination)
	}
	if input.App != nil {
		urls = append(urls, input.App.WebFallbackUrl)
	}
	return urls
}

func RunDestinationChecks(input types.CreativeInput) []types.AutoCheckFlag {
	var blocked []string
	if loaded := blockedDestinationDomains.Load(); loaded != nil {
		blocked = *loaded
	}
	flags := []types.AutoCheckFlag{}
	for _, link := range destinationUrls(input) {
		flags = append(flags, adsservices.DestinationHostFlags(link, blocked)...)
	}
	return flags
}

func RunAutomatedPolicyChecks(input types.CreativeInput) []types.AutoCheckFlag {
	text := creativeText(input)
	flags := RunDestinationChecks(input)
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
