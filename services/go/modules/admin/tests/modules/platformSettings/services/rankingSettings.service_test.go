package services_test

import (
	"encoding/json"
	"testing"

	"nantty/modules/admin/src/modules/platformSettings/services"
)

func TestFeedRankingPolicyEnforcesHardCapsAndTierOrder(t *testing.T) {
	cases := []struct {
		name  string
		input string
		valid bool
	}{
		{"defaults", `{"tierBoostBps":{"blue_essential":10200,"blue_verified":10400,"premium":10600,"gold_business":10800,"black_official":11000},"officialEditorialBoostBps":11000}`, true},
		{"all neutral", `{"tierBoostBps":{"blue_essential":10000,"blue_verified":10000,"premium":10000,"gold_business":10000,"black_official":10000},"officialEditorialBoostBps":10000}`, true},
		{"above hard cap", `{"tierBoostBps":{"blue_essential":10200,"blue_verified":10400,"premium":10600,"gold_business":10800,"black_official":20000},"officialEditorialBoostBps":11000}`, false},
		{"official above cap", `{"tierBoostBps":{"blue_essential":10200,"blue_verified":10400,"premium":10600,"gold_business":10800,"black_official":11000},"officialEditorialBoostBps":11600}`, false},
		{"demotion below neutral", `{"tierBoostBps":{"blue_essential":9000,"blue_verified":10400,"premium":10600,"gold_business":10800,"black_official":11000},"officialEditorialBoostBps":11000}`, false},
		{"order broken", `{"tierBoostBps":{"blue_essential":10200,"blue_verified":10400,"premium":11000,"gold_business":10800,"black_official":11000},"officialEditorialBoostBps":11000}`, false},
		{"missing tier", `{"tierBoostBps":{"blue_essential":10200,"blue_verified":10400,"premium":10600,"gold_business":10800},"officialEditorialBoostBps":11000}`, false},
		{"unknown tier", `{"tierBoostBps":{"blue_essential":10200,"blue_verified":10400,"premium":10600,"gold_business":10800,"vip":11000},"officialEditorialBoostBps":11000}`, false},
		{"manual push lever rejected", `{"tierBoostBps":{"blue_essential":10200,"blue_verified":10400,"premium":10600,"gold_business":10800,"black_official":11000},"officialEditorialBoostBps":11000,"pushPostIds":["p1"]}`, false},
	}
	for _, testCase := range cases {
		_, err := services.PlatformSettingDefinitions[services.FeedRankingKey].Validate(json.RawMessage(testCase.input))
		if (err == nil) != testCase.valid {
			t.Errorf("%s: err=%v", testCase.name, err)
		}
	}
}

func TestTrendingModerationOnlyRemovesWithAPolicyReason(t *testing.T) {
	cases := []struct {
		name  string
		input string
		valid bool
	}{
		{"empty", `{"removals":[]}`, true},
		{"hashtag removal", `{"removals":[{"kind":"hashtag","key":"buyfollowers","country":"NG","reason":"manipulation","note":"ring","removedAt":"2026-10-04T10:00:00Z"}]}`, true},
		{"headline removal global", `{"removals":[{"kind":"headline","key":"lagosfloods","country":"","reason":"misinformation","note":"","removedAt":"2026-10-04T10:00:00Z"}]}`, true},
		{"no reason", `{"removals":[{"kind":"hashtag","key":"x","country":"","reason":"","note":"","removedAt":"2026-10-04T10:00:00Z"}]}`, false},
		{"promote is not a kind", `{"removals":[{"kind":"promote","key":"x","country":"","reason":"other","note":"","removedAt":"2026-10-04T10:00:00Z"}]}`, false},
		{"pin field rejected", `{"removals":[],"pinned":["x"]}`, false},
		{"bad country", `{"removals":[{"kind":"hashtag","key":"x","country":"Nigeria","reason":"spam","note":"","removedAt":"2026-10-04T10:00:00Z"}]}`, false},
		{"duplicate", `{"removals":[{"kind":"hashtag","key":"x","country":"","reason":"spam","note":"","removedAt":"2026-10-04T10:00:00Z"},{"kind":"hashtag","key":"x","country":"","reason":"hate","note":"","removedAt":"2026-10-04T10:00:00Z"}]}`, false},
	}
	for _, testCase := range cases {
		_, err := services.PlatformSettingDefinitions[services.TrendingModerationKey].Validate(json.RawMessage(testCase.input))
		if (err == nil) != testCase.valid {
			t.Errorf("%s: err=%v", testCase.name, err)
		}
	}
}

func TestRankingDefaultsPassTheirOwnValidators(t *testing.T) {
	for _, key := range []string{services.FeedRankingKey, services.TrendingModerationKey} {
		definition := services.PlatformSettingDefinitions[key]
		raw, _ := json.Marshal(definition.DefaultValue)
		if _, err := definition.Validate(raw); err != nil {
			t.Errorf("%s default rejected: %v", key, err)
		}
	}
}
