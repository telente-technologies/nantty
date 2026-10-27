package services

import (
	"context"

	"nantty/modules/live/src/generated/ent/gift"
)

type seedGiftGroup struct {
	tier, displayLevel, haptic string
	comboable                  bool
}

var seedGroups = map[string]seedGiftGroup{
	"quick":     {"basic", "micro", "light", true},
	"fun":       {"basic", "medium", "medium", true},
	"premium":   {"premium", "large", "heavy", false},
	"legendary": {"legendary", "global", "pattern", false},
}

type seedGift struct {
	group     string
	sortOrder int
	id, name  string
	price     int64
	assetKey  string
	duration  int
}

var defaultGiftSeeds = []seedGift{
	{"quick", 1, "like", "Like", 1, "like-v1", 900}, {"quick", 2, "clap", "Clap", 1, "clap-v1", 900},
	{"quick", 3, "fire", "Fire", 2, "fire-v1", 1000}, {"quick", 4, "heart", "Heart", 5, "heart-v1", 1200},
	{"quick", 5, "star", "Star", 5, "star-v1", 1200}, {"quick", 6, "thumbs_up", "Thumbs Up", 3, "thumbs-up-v1", 900},
	{"quick", 7, "smile", "Smile", 3, "smile-v1", 900}, {"quick", 8, "sparkle", "Sparkle", 9, "sparkle-v1", 1500},
	{"fun", 10, "rose", "Rose", 10, "rose-v2", 2200}, {"fun", 11, "gift_box", "Gift Box", 30, "gift-box-v1", 2200},
	{"fun", 12, "crown", "Crown", 99, "crown-v1", 2400}, {"fun", 13, "diamond", "Diamond", 149, "diamond-v1", 2400},
	{"fun", 14, "rocket", "Rocket", 199, "rocket-v2", 2500}, {"fun", 15, "lightning", "Lightning", 49, "lightning-v1", 2000},
	{"fun", 16, "fireworks", "Fireworks", 249, "fireworks-v1", 2500}, {"fun", 17, "money_rain", "Money Rain", 299, "money-rain-v1", 2500},
	{"premium", 20, "golden_crown", "Golden Crown", 500, "golden-crown-v1", 4000}, {"premium", 21, "luxury_car", "Luxury Car", 1000, "luxury-car-v1", 4500},
	{"premium", 22, "private_jet", "Private Jet", 2000, "private-jet-v1", 5000}, {"premium", 23, "treasure_chest", "Treasure Chest", 1500, "treasure-chest-v1", 4500},
	{"premium", 24, "diamond_shower", "Diamond Shower", 2500, "diamond-shower-v1", 5000}, {"premium", 25, "golden_rain", "Golden Rain", 3000, "golden-rain-v1", 5000},
	{"premium", 26, "supernova", "Supernova", 4000, "supernova-v1", 5000}, {"legendary", 30, "nantty_galaxy", "Nantty Galaxy", 10000, "nantty-galaxy-v1", 6500},
	{"legendary", 31, "nantty_king", "Nantty King", 20000, "nantty-king-v1", 7000}, {"legendary", 32, "nantty_empire", "Nantty Empire", 30000, "nantty-empire-v1", 7000},
}

type seedPointsRule struct {
	id                         string
	points                     int64
	perMinute, perDay, perLive int
}

var defaultPointsRules = []seedPointsRule{
	{"like", 1, 10, 1000, 0}, {"share", 5, 0, 20, 1}, {"follow", 10, 0, 50, 1}, {"watch", 2, 1, 600, 0}, {"gift", 1, 0, 0, 0}, {"giftReceived", 1, 0, 0, 0},
}

func (service *LiveService) SeedDefaultCatalogAndPointsRules(ctx context.Context) error {
	for _, seed := range defaultGiftSeeds {
		group := seedGroups[seed.group]
		err := service.Client.Gift.Create().SetID("gift_" + seed.id).SetName(seed.name).SetTier(gift.Tier(group.tier)).SetPriceCoins(seed.price).
			SetAnimationEngine(gift.AnimationEngineLottie).SetAnimationAssetKey(seed.assetKey).SetPreviewAssetKey(seed.assetKey).SetDurationMs(seed.duration).
			SetDisplayLevel(gift.DisplayLevel(group.displayLevel)).SetHaptic(gift.Haptic(group.haptic)).SetComboable(group.comboable).SetSortOrder(seed.sortOrder).
			OnConflictColumns(gift.FieldID).Ignore().Exec(ctx)
		if err != nil {
			return err
		}
	}
	for _, rule := range defaultPointsRules {
		err := service.Client.PointsRule.Create().SetID(rule.id).SetPoints(rule.points).SetPerMinuteCap(rule.perMinute).SetPerDayCap(rule.perDay).SetPerLiveCap(rule.perLive).
			OnConflictColumns("id").Ignore().Exec(ctx)
		if err != nil {
			return err
		}
	}
	return nil
}
