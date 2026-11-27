package services

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adfrequencypolicy"
	"nantty/modules/ads/src/generated/ent/predicate"
)

const policyCacheLifetime = 30 * time.Second

type PlatformSettingReader interface {
	ReadValue(ctx context.Context, key string) (json.RawMessage, bool)
}

const (
	MonetizationSettingKey = "monetization.policy"
	RevenueSettingKey      = "revenue"
)

type PolicySource struct {
	Client   *ent.Client
	Now      func() time.Time
	Settings PlatformSettingReader
	ShareBps int64
	Logger   *slog.Logger
	mutex    sync.Mutex
	loaded   time.Time
	freq     map[string]FrequencyPolicy
}

func DefaultFrequencyPolicies() map[string]FrequencyPolicy {
	return map[string]FrequencyPolicy{
		FrequencyPolicyAllFormats: {Format: FrequencyPolicyAllFormats, SessionCap: 12, HourCap: 16, DayCap: 40, AdvertiserDayCap: 0, MinGapSlots: 0, CooldownSecondsAfterSkip: 0},
		"feed":                    {Format: "feed", SessionCap: 6, HourCap: 8, DayCap: 20, AdvertiserDayCap: 5, MinGapSlots: 4, CooldownSecondsAfterSkip: 300},
		"clips":                   {Format: "clips", SessionCap: 6, HourCap: 8, DayCap: 20, AdvertiserDayCap: 5, MinGapSlots: 5, CooldownSecondsAfterSkip: 300},
		"mart":                    {Format: "mart", SessionCap: 8, HourCap: 12, DayCap: 30, AdvertiserDayCap: 8, MinGapSlots: 4, CooldownSecondsAfterSkip: 0},
		"search":                  {Format: "search", SessionCap: 8, HourCap: 12, DayCap: 30, AdvertiserDayCap: 8, MinGapSlots: 4, CooldownSecondsAfterSkip: 0},
		"stories":                 {Format: "stories", SessionCap: 4, HourCap: 6, DayCap: 12, AdvertiserDayCap: 3, MinGapSlots: 3, CooldownSecondsAfterSkip: 300},
		"live":                    {Format: "live", SessionCap: 3, HourCap: 4, DayCap: 8, AdvertiserDayCap: 2, MinGapSlots: 0, CooldownSecondsAfterSkip: 600},
	}
}

func (source *PolicySource) SeedDefaultsWhenMissing(ctx context.Context) error {
	for format, policy := range DefaultFrequencyPolicies() {
		exists, err := source.Client.AdFrequencyPolicy.Query().Where(adFrequencyFormatEquals(format)).Exist(ctx)
		if err != nil {
			return err
		}
		if exists {
			continue
		}
		if err := source.Client.AdFrequencyPolicy.Create().SetFormat(format).SetSessionCap(policy.SessionCap).SetHourCap(policy.HourCap).SetDayCap(policy.DayCap).
			SetAdvertiserDayCap(policy.AdvertiserDayCap).SetMinGapSlots(policy.MinGapSlots).SetCooldownSecondsAfterSkip(policy.CooldownSecondsAfterSkip).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (source *PolicySource) MonetizationRows(ctx context.Context) ([]MonetizationPolicyRow, error) {
	if source.Settings == nil {
		return nil, nil
	}
	raw, found := source.Settings.ReadValue(ctx, MonetizationSettingKey)
	if !found {
		return nil, nil
	}
	return ParseMonetizationSetting(raw, source.CreatorShareBps(ctx)), nil
}

func (source *PolicySource) CreatorShareBps(ctx context.Context) int64 {
	fallback := source.shareBps()
	if source.Settings == nil {
		return fallback
	}
	raw, found := source.Settings.ReadValue(ctx, RevenueSettingKey)
	if !found {
		return fallback
	}
	var revenue struct {
		CreatorAdShareBasisPoints *int64 `json:"creatorAdShareBasisPoints"`
	}
	if json.Unmarshal(raw, &revenue) != nil || revenue.CreatorAdShareBasisPoints == nil || *revenue.CreatorAdShareBasisPoints < 0 || *revenue.CreatorAdShareBasisPoints > 10_000 {
		if source.Logger != nil {
			source.Logger.Warn("revenue setting has no readable creator ad share, using the environment value")
		}
		return fallback
	}
	return *revenue.CreatorAdShareBasisPoints
}

func (source *PolicySource) shareBps() int64 {
	if source.ShareBps > 0 {
		return source.ShareBps
	}
	return DefaultCreatorShareBps
}

func ParseMonetizationSetting(raw json.RawMessage, shareBps int64) []MonetizationPolicyRow {
	var setting struct {
		Rows []struct {
			Id            string `json:"id"`
			MultiplierBps int64  `json:"multiplierBps"`
			Active        bool   `json:"active"`
		} `json:"rows"`
	}
	if json.Unmarshal(raw, &setting) != nil {
		return nil
	}
	rows := make([]MonetizationPolicyRow, 0, len(setting.Rows))
	for _, row := range setting.Rows {
		if row.Active && row.MultiplierBps >= 0 && row.MultiplierBps <= 30_000 {
			rows = append(rows, MonetizationPolicyRow{ContentType: row.Id, CreatorShareBps: shareBps, MultiplierBps: row.MultiplierBps})
		}
	}
	return rows
}

func (source *PolicySource) FrequencyPolicies(ctx context.Context) (map[string]FrequencyPolicy, error) {
	if err := source.refreshWhenStale(ctx); err != nil {
		return nil, err
	}
	return source.freq, nil
}

func (source *PolicySource) Invalidate() {
	source.mutex.Lock()
	source.loaded = time.Time{}
	source.mutex.Unlock()
}

func (source *PolicySource) refreshWhenStale(ctx context.Context) error {
	source.mutex.Lock()
	defer source.mutex.Unlock()
	if source.freq != nil && source.Now().Sub(source.loaded) < policyCacheLifetime {
		return nil
	}
	stored, err := source.Client.AdFrequencyPolicy.Query().All(ctx)
	if err != nil {
		return err
	}
	frequency := DefaultFrequencyPolicies()
	for _, policy := range stored {
		if !policy.Active {
			delete(frequency, policy.Format)
			continue
		}
		frequency[policy.Format] = FrequencyPolicy{Format: policy.Format, SessionCap: policy.SessionCap, HourCap: policy.HourCap, DayCap: policy.DayCap, AdvertiserDayCap: policy.AdvertiserDayCap, MinGapSlots: policy.MinGapSlots, CooldownSecondsAfterSkip: policy.CooldownSecondsAfterSkip}
	}
	source.freq, source.loaded = frequency, source.Now()
	return nil
}

func adFrequencyFormatEquals(format string) predicate.AdFrequencyPolicy {
	return adfrequencypolicy.Format(format)
}
