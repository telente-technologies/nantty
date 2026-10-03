package application

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
)

const (
	CreatorRequirementsKey = "creator.requirements"
	MonetizationPolicyKey  = "monetization.policy"
	GiftShareTiersKey      = "gift.shareTiers"
	maximumCreatorShareBps = 7000
)

type settingDefinition struct {
	validate     func(raw json.RawMessage) (json.RawMessage, error)
	defaultValue any
	public       bool
}

var platformSettingDefinitions = map[string]settingDefinition{
	CreatorRequirementsKey: {validate: validateCreatorRequirements, public: true, defaultValue: CreatorRequirements{
		MinimumFollowers: 1000, MinimumAccountAgeDays: 30, MinimumOriginalPosts: 10, MaximumRecentStrikes: 0, StrikeLookbackDays: 90, RequireVerifiedEmail: true,
	}},
	MonetizationPolicyKey: {validate: validateMonetizationPolicy, defaultValue: MonetizationPolicy{Rows: []MonetizationRow{
		{Id: "original", Label: "Original content", MultiplierBps: 10000, Active: true},
		{Id: "ai_generated", Label: "AI-generated content", MultiplierBps: 5000, Active: true},
	}}},
	GiftShareTiersKey: {validate: validateGiftShareTiers, defaultValue: GiftShareTiers{Tiers: []GiftShareTier{
		{MinimumMonthlyGiftCoins: 0, CreatorShareBps: 5000},
		{MinimumMonthlyGiftCoins: 500000, CreatorShareBps: 6000},
		{MinimumMonthlyGiftCoins: 5000000, CreatorShareBps: maximumCreatorShareBps},
	}}},
}

type CreatorRequirements struct {
	MinimumFollowers      int  `json:"minimumFollowers"`
	MinimumAccountAgeDays int  `json:"minimumAccountAgeDays"`
	MinimumOriginalPosts  int  `json:"minimumOriginalPosts"`
	MaximumRecentStrikes  int  `json:"maximumRecentStrikes"`
	StrikeLookbackDays    int  `json:"strikeLookbackDays"`
	RequireVerifiedEmail  bool `json:"requireVerifiedEmail"`
}

type MonetizationRow struct {
	Id            string `json:"id"`
	Label         string `json:"label"`
	MultiplierBps int    `json:"multiplierBps"`
	Active        bool   `json:"active"`
}

type MonetizationPolicy struct {
	Rows []MonetizationRow `json:"rows"`
}

type GiftShareTier struct {
	MinimumMonthlyGiftCoins int64 `json:"minimumMonthlyGiftCoins"`
	CreatorShareBps         int   `json:"creatorShareBps"`
}

type GiftShareTiers struct {
	Tiers []GiftShareTier `json:"tiers"`
}

var monetizationRowIdPattern = regexp.MustCompile(`^[a-z0-9_]{2,40}$`)

func decodeStrictly[Value any](raw json.RawMessage, destination *Value) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return unprocessable("The value does not match this setting: " + err.Error())
	}
	if decoder.More() {
		return unprocessable("The value has trailing data.")
	}
	return nil
}

func requireWithin(name string, value, minimum, maximum int) error {
	if value < minimum || value > maximum {
		return unprocessable(fmt.Sprintf("%s must be between %d and %d.", name, minimum, maximum))
	}
	return nil
}

func canonicalJson(value any) (json.RawMessage, error) {
	return json.Marshal(value)
}

func validateCreatorRequirements(raw json.RawMessage) (json.RawMessage, error) {
	var value CreatorRequirements
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	for _, check := range []error{
		requireWithin("minimumFollowers", value.MinimumFollowers, 0, 10_000_000),
		requireWithin("minimumAccountAgeDays", value.MinimumAccountAgeDays, 0, 3650),
		requireWithin("minimumOriginalPosts", value.MinimumOriginalPosts, 0, 100_000),
		requireWithin("maximumRecentStrikes", value.MaximumRecentStrikes, 0, 100),
		requireWithin("strikeLookbackDays", value.StrikeLookbackDays, 1, 3650),
	} {
		if check != nil {
			return nil, check
		}
	}
	return canonicalJson(value)
}

func validateMonetizationPolicy(raw json.RawMessage) (json.RawMessage, error) {
	var value MonetizationPolicy
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := requireWithin("rows", len(value.Rows), 1, 50); err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, row := range value.Rows {
		if !monetizationRowIdPattern.MatchString(row.Id) || seen[row.Id] {
			return nil, unprocessable("Row ids must be unique, 2-40 lowercase letters, numbers or underscores.")
		}
		seen[row.Id] = true
		if err := requireWithin("label length", len(row.Label), 1, 80); err != nil {
			return nil, err
		}
		if err := requireWithin("multiplierBps", row.MultiplierBps, 0, 30000); err != nil {
			return nil, err
		}
	}
	return canonicalJson(value)
}

func validateGiftShareTiers(raw json.RawMessage) (json.RawMessage, error) {
	var value GiftShareTiers
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := requireWithin("tiers", len(value.Tiers), 1, 20); err != nil {
		return nil, err
	}
	if value.Tiers[0].MinimumMonthlyGiftCoins != 0 {
		return nil, unprocessable("The first tier must start at 0 coins.")
	}
	for index, tier := range value.Tiers {
		if tier.CreatorShareBps < 0 || tier.CreatorShareBps > maximumCreatorShareBps {
			return nil, unprocessable(fmt.Sprintf("creatorShareBps must be between 0 and %d.", maximumCreatorShareBps))
		}
		if index > 0 && tier.MinimumMonthlyGiftCoins <= value.Tiers[index-1].MinimumMonthlyGiftCoins {
			return nil, unprocessable("Tier thresholds must be strictly ascending.")
		}
	}
	return canonicalJson(value)
}
