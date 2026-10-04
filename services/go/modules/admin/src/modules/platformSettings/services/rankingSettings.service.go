package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	adminerrors "zudomart/modules/admin/src/errors"
)

const (
	FeedRankingKey        = "feed.ranking"
	TrendingModerationKey = "trending.moderation"
	neutralBoostBps       = 10000
	maximumTrendRemovals  = 500
)

var RankingTierOrderFromLowest = []string{"blue_essential", "blue_verified", "premium", "gold_business", "black_official"}

var HardMaximumTierBoostBps = map[string]int{
	"blue_essential": 10500,
	"blue_verified":  10800,
	"premium":        11000,
	"gold_business":  11200,
	"black_official": 11500,
}

const HardMaximumOfficialEditorialBoostBps = 11500

type FeedRankingPolicy struct {
	TierBoostBps              map[string]int `json:"tierBoostBps"`
	OfficialEditorialBoostBps int            `json:"officialEditorialBoostBps"`
}

var DefaultFeedRankingPolicy = FeedRankingPolicy{
	TierBoostBps:              map[string]int{"blue_essential": 10200, "blue_verified": 10400, "premium": 10600, "gold_business": 10800, "black_official": 11000},
	OfficialEditorialBoostBps: 11000,
}

type TrendRemoval struct {
	Kind      string `json:"kind"`
	Key       string `json:"key"`
	Country   string `json:"country"`
	Reason    string `json:"reason"`
	Note      string `json:"note"`
	RemovedAt string `json:"removedAt"`
}

type TrendingModeration struct {
	Removals []TrendRemoval `json:"removals"`
}

var (
	trendKeyPattern     = regexp.MustCompile(`^[a-z0-9_\-]{1,64}$`)
	countryCodePattern  = regexp.MustCompile(`^[A-Z]{2}$`)
	trendRemovalKinds   = map[string]bool{"hashtag": true, "topic": true, "headline": true}
	trendRemovalReasons = map[string]bool{"spam": true, "manipulation": true, "hate": true, "harassment": true, "misinformation": true, "violence": true, "sexual": true, "illegal": true, "privacy": true, "other": true}
)

func validateFeedRankingPolicy(raw json.RawMessage) (json.RawMessage, error) {
	var value FeedRankingPolicy
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if len(value.TierBoostBps) != len(RankingTierOrderFromLowest) {
		return nil, adminerrors.Unprocessable("tierBoostBps must list exactly: " + strings.Join(RankingTierOrderFromLowest, ", ") + ".")
	}
	previous := neutralBoostBps
	for _, tier := range RankingTierOrderFromLowest {
		boost, present := value.TierBoostBps[tier]
		if !present {
			return nil, adminerrors.Unprocessable(fmt.Sprintf("tierBoostBps is missing %s.", tier))
		}
		if err := requireWithin(tier, boost, neutralBoostBps, HardMaximumTierBoostBps[tier]); err != nil {
			return nil, err
		}
		if boost < previous {
			return nil, adminerrors.Unprocessable("Boosts must keep the order Blue Essential ≤ Blue Verified ≤ Premium ≤ Gold Business ≤ Black/Official.")
		}
		previous = boost
	}
	if err := requireWithin("officialEditorialBoostBps", value.OfficialEditorialBoostBps, neutralBoostBps, HardMaximumOfficialEditorialBoostBps); err != nil {
		return nil, err
	}
	return canonicalJson(value)
}

func validateTrendingModeration(raw json.RawMessage) (json.RawMessage, error) {
	var value TrendingModeration
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if value.Removals == nil {
		value.Removals = []TrendRemoval{}
	}
	if err := requireWithin("removals", len(value.Removals), 0, maximumTrendRemovals); err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, removal := range value.Removals {
		if !trendRemovalKinds[removal.Kind] {
			return nil, adminerrors.Unprocessable("kind must be hashtag, topic or headline.")
		}
		if !trendKeyPattern.MatchString(removal.Key) {
			return nil, adminerrors.Unprocessable("key must be 1-64 lowercase letters, numbers, - or _.")
		}
		if removal.Country != "" && !countryCodePattern.MatchString(removal.Country) {
			return nil, adminerrors.Unprocessable("country must be empty or a two-letter code.")
		}
		if !trendRemovalReasons[removal.Reason] {
			return nil, adminerrors.Unprocessable("reason must be a policy reason code.")
		}
		if err := requireWithin("note length", len(removal.Note), 0, 500); err != nil {
			return nil, err
		}
		if _, err := time.Parse(time.RFC3339, removal.RemovedAt); err != nil {
			return nil, adminerrors.Unprocessable("removedAt must be an RFC 3339 time.")
		}
		identity := removal.Kind + "|" + removal.Key + "|" + removal.Country
		if seen[identity] {
			return nil, adminerrors.Unprocessable("Each removal must be unique per kind, key and country.")
		}
		seen[identity] = true
	}
	return canonicalJson(value)
}
