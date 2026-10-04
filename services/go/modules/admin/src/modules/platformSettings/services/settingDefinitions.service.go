package services

import (
	"encoding/json"
	"regexp"

	"zudomart/platform/regionpricing"
)

const (
	CreatorRequirementsKey = "creator.requirements"
	MonetizationPolicyKey  = "monetization.policy"
	GiftShareTiersKey      = "gift.shareTiers"
	EscrowPolicyKey        = "escrow.policy"
	RegionalPricingKey     = regionpricing.SettingKey
	maximumCreatorShareBps = 7000
)

type SettingDefinition struct {
	Validate              func(raw json.RawMessage) (json.RawMessage, error)
	DefaultValue          any
	Public                bool
	WritePermission       string
	ExtraWritePermissions []string
}

var PlatformSettingDefinitions = map[string]SettingDefinition{
	CreatorRequirementsKey: {Validate: validateCreatorRequirements, Public: true, WritePermission: "config:rules", DefaultValue: CreatorRequirements{
		MinimumFollowers: 1000, MinimumAccountAgeDays: 30, MinimumOriginalPosts: 10, MaximumRecentStrikes: 0, StrikeLookbackDays: 90, RequireVerifiedEmail: true,
	}},
	MonetizationPolicyKey: {Validate: validateMonetizationPolicy, WritePermission: "config:revenue", DefaultValue: MonetizationPolicy{Rows: []MonetizationRow{
		{Id: "original", Label: "Original content", MultiplierBps: 10000, Active: true},
		{Id: "ai_generated", Label: "AI-generated content", MultiplierBps: 3000, Active: true},
	}}},
	GiftShareTiersKey: {Validate: validateGiftShareTiers, WritePermission: "config:revenue", DefaultValue: GiftShareTiers{Tiers: []GiftShareTier{
		{MinimumMonthlyGiftCoins: 0, CreatorShareBps: 5000},
		{MinimumMonthlyGiftCoins: 500000, CreatorShareBps: 6000},
		{MinimumMonthlyGiftCoins: 5000000, CreatorShareBps: maximumCreatorShareBps},
	}}},
	FeedRankingKey:        {Validate: validateFeedRankingPolicy, WritePermission: "config:rules", DefaultValue: DefaultFeedRankingPolicy},
	TrendingModerationKey: {Validate: validateTrendingModeration, WritePermission: "content:review", ExtraWritePermissions: []string{"moderation:reports"}, DefaultValue: TrendingModeration{Removals: []TrendRemoval{}}},
	EscrowPolicyKey:       {Validate: validateEscrowPolicy, WritePermission: "config:revenue", DefaultValue: EscrowPolicy{AutoReleaseDays: 3, SellerCreditHoldHours: 24, SellerReserveBps: 0}},
	RegionalPricingKey:    {Validate: validateRegionalPricing, Public: true, WritePermission: "config:revenue", DefaultValue: regionpricing.DefaultSettingDocument()},
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

type EscrowPolicy struct {
	AutoReleaseDays       int `json:"autoReleaseDays"`
	SellerCreditHoldHours int `json:"sellerCreditHoldHours"`
	SellerReserveBps      int `json:"sellerReserveBps"`
}

type GiftShareTiers struct {
	Tiers []GiftShareTier `json:"tiers"`
}

var monetizationRowIdPattern = regexp.MustCompile(`^[a-z0-9_]{2,40}$`)
