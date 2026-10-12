package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"slices"

	adminerrors "zudomart/modules/admin/src/errors"
)

const (
	PlansKey              = "plans"
	RevenueRulesKey       = "revenue"
	CreatorEligibilityKey = "creator-eligibility"
	UsernameRulesKey      = "username-rules"
)

var (
	currencyCodePattern = regexp.MustCompile(`^[A-Z]{3}$`)
	isoCountryPattern   = regexp.MustCompile(`^[A-Z]{2}$`)
	planKeyPattern      = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,39}$`)
	entitlementPattern  = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{1,39}$`)
	launchCurrencies    = []string{"NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"}
	planTiersByColor    = map[string][]string{"BLUE": {"ESSENTIAL", "VERIFIED", "PREMIUM"}, "GOLD": {"ONLY", "PRO", "BUSINESS", "PREMIUM"}, "BLACK": {"OFFICIAL"}}
	usernameCharacters  = []string{"LOWERCASE_LETTERS", "DIGITS", "DOT", "UNDERSCORE"}
)

type DashboardEntitlement struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Limit *int   `json:"limit"`
}

type VerificationPlan struct {
	PlanKey               string                 `json:"planKey"`
	Color                 string                 `json:"color"`
	Tier                  string                 `json:"tier"`
	DisplayName           string                 `json:"displayName"`
	BadgeVisible          bool                   `json:"badgeVisible"`
	IsPurchasable         bool                   `json:"isPurchasable"`
	Perks                 []string               `json:"perks"`
	DashboardEntitlements []DashboardEntitlement `json:"dashboardEntitlements"`
	AdLoadPercent         *int                   `json:"adLoadPercent,omitempty"`
}

type PlansConfiguration struct {
	SupportedCurrencies []string           `json:"supportedCurrencies"`
	FreeAdLoadPercent   *int               `json:"freeAdLoadPercent,omitempty"`
	Plans               []VerificationPlan `json:"plans"`
}

type RevenueRulesConfiguration struct {
	SupportedCurrencies                []string     `json:"supportedCurrencies"`
	CreatorAdShareBasisPoints          int          `json:"creatorAdShareBasisPoints"`
	GiftCreatorShareBasisPoints        int          `json:"giftCreatorShareBasisPoints"`
	GiftCreatorShareCeilingBasisPoints int          `json:"giftCreatorShareCeilingBasisPoints"`
	CoinTransferFeeBasisPoints         int          `json:"coinTransferFeeBasisPoints"`
	CoinUnitValues                     []MoneyValue `json:"coinUnitValues"`
	WithdrawalFee                      struct {
		Mode string `json:"mode"`
		Note string `json:"note"`
	} `json:"withdrawalFee"`
	EscrowFee struct {
		DefaultBasisPoints      int `json:"defaultBasisPoints"`
		BusinessPlanBasisPoints int `json:"businessPlanBasisPoints"`
	} `json:"escrowFee"`
}

type UsernameRules struct {
	ChangesAllowedPerWindow      int      `json:"changesAllowedPerWindow"`
	ChangeWindowDays             int      `json:"changeWindowDays"`
	MinimumLength                int      `json:"minimumLength"`
	MaximumLength                int      `json:"maximumLength"`
	AllowedCharacterClasses      []string `json:"allowedCharacterClasses"`
	MustStartWithLetter          bool     `json:"mustStartWithLetter"`
	ReleasedUsernameCooldownDays int      `json:"releasedUsernameCooldownDays"`
}

func init() {
	for key, definition := range map[string]SettingDefinition{
		PlansKey:              {Validate: validatePlansConfiguration, WritePermission: "config:plans", DefaultValue: defaultPlansConfiguration()},
		RevenueRulesKey:       {Validate: validateRevenueRules, WritePermission: "config:revenue", DefaultValue: defaultRevenueRules()},
		CreatorEligibilityKey: {Validate: validateCreatorEligibility, WritePermission: "config:rules", Projection: &SettingProjection{SourceKey: CreatorThresholdsKey, Project: projectCreatorEligibility, Merge: mergeCreatorEligibility}},
		UsernameRulesKey:      {Validate: validateUsernameRules, WritePermission: "config:rules", DefaultValue: defaultUsernameRules()},
	} {
		PlatformSettingDefinitions[key] = definition
	}
}

func defaultPlansConfiguration() PlansConfiguration {
	plan := func(key, color, tier, name string, badge, purchasable bool, perks ...string) VerificationPlan {
		adLoad := DefaultAdLoadPercentByPlanKey[key]
		return VerificationPlan{PlanKey: key, Color: color, Tier: tier, DisplayName: name, BadgeVisible: badge, IsPurchasable: purchasable, Perks: perks, DashboardEntitlements: []DashboardEntitlement{}, AdLoadPercent: &adLoad}
	}
	freeAdLoad := fullAdLoadPercent
	sellerPlan := func(plan VerificationPlan, staffSeats, storeLocations, catalogImport int) VerificationPlan {
		plan.DashboardEntitlements = []DashboardEntitlement{
			{Key: "staffSeats", Label: "Staff seats", Limit: &staffSeats},
			{Key: "storeLocations", Label: "Store locations", Limit: &storeLocations},
			{Key: "advancedReports", Label: "Advanced sales reports and exports"},
			{Key: "catalogImport", Label: "Bulk catalog import (CSV)", Limit: &catalogImport},
		}
		return plan
	}
	return PlansConfiguration{SupportedCurrencies: launchCurrencies, FreeAdLoadPercent: &freeAdLoad, Plans: []VerificationPlan{
		plan("BLUE_ESSENTIAL", "BLUE", "ESSENTIAL", "Blue Essential", false, true, "Priority account recovery", "Impersonation protection", "Edit posts within 1 hour", "Fewer ads"),
		plan("BLUE_VERIFIED", "BLUE", "VERIFIED", "Blue Verified", true, true, "Blue badge on profile and posts", "Priority ranking in comments", "Longer clips (up to 10 minutes)", "Fewer ads"),
		plan("BLUE_PREMIUM", "BLUE", "PREMIUM", "Blue Premium", true, true, "Everything in Blue Verified", "No ads anywhere", "Monthly boost credit", "Priority support"),
		plan("GOLD_ONLY", "GOLD", "ONLY", "Gold", true, true, "Gold business badge", "Verified store label on products", "Fewer ads"),
		sellerPlan(plan("GOLD_PRO", "GOLD", "PRO", "Gold Pro", true, true, "Gold business badge", "Zudomart Dashboard access", "Verified store label on products", "Fewer ads"), 3, 1, 2_000),
		sellerPlan(plan("GOLD_BUSINESS", "GOLD", "BUSINESS", "Gold Business", true, true, "Everything in Gold Pro", "Dedicated account manager", "Lower escrow fee", "No ads anywhere"), 15, 10, 20_000),
		plan("BLACK_OFFICIAL", "BLACK", "OFFICIAL", "Black Official", true, false, "Government and public institution badge", "Very few ads"),
	}}
}

func defaultRevenueRules() RevenueRulesConfiguration {
	rules := RevenueRulesConfiguration{
		SupportedCurrencies: launchCurrencies, CreatorAdShareBasisPoints: 4000, GiftCreatorShareBasisPoints: 5000, GiftCreatorShareCeilingBasisPoints: maximumCreatorShareBps,
		CoinTransferFeeBasisPoints: 2500, CoinUnitValues: []MoneyValue{
			{AmountMinor: 1000, Currency: "NGN"}, {AmountMinor: 10, Currency: "GHS"}, {AmountMinor: 100, Currency: "KES"}, {AmountMinor: 15, Currency: "ZAR"},
			{AmountMinor: 1, Currency: "GBP"}, {AmountMinor: 1, Currency: "EUR"}, {AmountMinor: 1, Currency: "USD"},
		},
	}
	rules.WithdrawalFee.Mode, rules.WithdrawalFee.Note = "PASS_THROUGH", "Daily automatic payouts are free; any provider transfer fee is passed through at cost with no Zudomart margin."
	rules.EscrowFee.DefaultBasisPoints, rules.EscrowFee.BusinessPlanBasisPoints = 150, 100
	return rules
}

func defaultUsernameRules() UsernameRules {
	return UsernameRules{ChangesAllowedPerWindow: 1, ChangeWindowDays: 30, MinimumLength: 3, MaximumLength: 30, AllowedCharacterClasses: usernameCharacters, MustStartWithLetter: false, ReleasedUsernameCooldownDays: 120}
}

func firstFailure(checks ...error) error {
	for _, check := range checks {
		if check != nil {
			return check
		}
	}
	return nil
}

func requireCodes(name string, codes []string, pattern *regexp.Regexp, minimum int) error {
	if len(codes) < minimum || len(codes) > 50 {
		return adminerrors.Unprocessable(fmt.Sprintf("%s must list between %d and 50 codes.", name, minimum))
	}
	for index, code := range codes {
		if !pattern.MatchString(code) || slices.Contains(codes[:index], code) {
			return adminerrors.Unprocessable(name + " has an invalid or repeated code: " + code)
		}
	}
	return nil
}

func validatePlansConfiguration(raw json.RawMessage) (json.RawMessage, error) {
	var value PlansConfiguration
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := firstFailure(requireCodes("supportedCurrencies", value.SupportedCurrencies, currencyCodePattern, 1), requireWithin("plans", len(value.Plans), 1, 30)); err != nil {
		return nil, err
	}
	if value.FreeAdLoadPercent != nil {
		if err := requireWithin("freeAdLoadPercent", *value.FreeAdLoadPercent, 0, fullAdLoadPercent); err != nil {
			return nil, err
		}
	}
	seen := map[string]bool{}
	for _, plan := range value.Plans {
		if !planKeyPattern.MatchString(plan.PlanKey) || seen[plan.PlanKey] || !slices.Contains(planTiersByColor[plan.Color], plan.Tier) {
			return nil, adminerrors.Unprocessable("Each plan needs a unique key and a tier that matches its color: " + plan.PlanKey)
		}
		if plan.Color == "BLACK" && plan.IsPurchasable {
			return nil, adminerrors.Unprocessable("Black Official is granted only through the official process and cannot be purchasable.")
		}
		if err := validatePlanAdLoad(plan); err != nil {
			return nil, err
		}
		seen[plan.PlanKey] = true
		if err := firstFailure(requireWithin(plan.PlanKey+".displayName", len(plan.DisplayName), 2, 60), requireWithin(plan.PlanKey+".perks", len(plan.Perks), 0, 20),
			requireWithin(plan.PlanKey+".dashboardEntitlements", len(plan.DashboardEntitlements), 0, 20)); err != nil {
			return nil, err
		}
		for _, entitlement := range plan.DashboardEntitlements {
			if !entitlementPattern.MatchString(entitlement.Key) || len(entitlement.Label) < 2 || len(entitlement.Label) > 120 || (entitlement.Limit != nil && (*entitlement.Limit < 0 || *entitlement.Limit > 1_000_000)) {
				return nil, adminerrors.Unprocessable("Dashboard entitlements need a key, a label and a limit between 0 and 1,000,000.")
			}
		}
	}
	return canonicalJson(value)
}

func validateRevenueRules(raw json.RawMessage) (json.RawMessage, error) {
	var value RevenueRulesConfiguration
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := firstFailure(
		requireCodes("supportedCurrencies", value.SupportedCurrencies, currencyCodePattern, 1),
		requireWithin("creatorAdShareBasisPoints", value.CreatorAdShareBasisPoints, 0, 10000),
		requireWithin("giftCreatorShareCeilingBasisPoints", value.GiftCreatorShareCeilingBasisPoints, 0, maximumCreatorShareBps),
		requireWithin("giftCreatorShareBasisPoints", value.GiftCreatorShareBasisPoints, 0, value.GiftCreatorShareCeilingBasisPoints),
		requireWithin("coinTransferFeeBasisPoints", value.CoinTransferFeeBasisPoints, 0, 5000),
		requireWithin("coinUnitValues", len(value.CoinUnitValues), 1, 50),
		requireWithin("escrowFee.defaultBasisPoints", value.EscrowFee.DefaultBasisPoints, 0, 1000),
		requireWithin("escrowFee.businessPlanBasisPoints", value.EscrowFee.BusinessPlanBasisPoints, 0, value.EscrowFee.DefaultBasisPoints),
		requireWithin("withdrawalFee.note", len(value.WithdrawalFee.Note), 0, 300),
	); err != nil {
		return nil, err
	}
	if value.WithdrawalFee.Mode != "PASS_THROUGH" {
		return nil, adminerrors.Unprocessable("withdrawalFee.mode must be PASS_THROUGH.")
	}
	for _, unit := range value.CoinUnitValues {
		if !currencyCodePattern.MatchString(unit.Currency) || unit.AmountMinor <= 0 {
			return nil, adminerrors.Unprocessable("Each coin unit value needs a currency and a positive amountMinor.")
		}
	}
	return canonicalJson(value)
}

func validateUsernameRules(raw json.RawMessage) (json.RawMessage, error) {
	var value UsernameRules
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := firstFailure(
		requireWithin("changesAllowedPerWindow", value.ChangesAllowedPerWindow, 0, 100),
		requireWithin("changeWindowDays", value.ChangeWindowDays, 1, 3650),
		requireWithin("minimumLength", value.MinimumLength, 1, 30),
		requireWithin("maximumLength", value.MaximumLength, value.MinimumLength, 30),
		requireWithin("releasedUsernameCooldownDays", value.ReleasedUsernameCooldownDays, 0, 3650),
		requireWithin("allowedCharacterClasses", len(value.AllowedCharacterClasses), 1, len(usernameCharacters)),
	); err != nil {
		return nil, err
	}
	for index, class := range value.AllowedCharacterClasses {
		if !slices.Contains(usernameCharacters, class) || slices.Contains(value.AllowedCharacterClasses[:index], class) {
			return nil, adminerrors.Unprocessable("allowedCharacterClasses has an unknown or repeated class: " + class)
		}
	}
	if value.MustStartWithLetter && !slices.Contains(value.AllowedCharacterClasses, "LOWERCASE_LETTERS") {
		return nil, adminerrors.Unprocessable("Usernames that must start with a letter need LOWERCASE_LETTERS allowed.")
	}
	return canonicalJson(value)
}
