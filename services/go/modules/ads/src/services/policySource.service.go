package services

import (
	"context"
	"sync"
	"time"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adfrequencypolicy"
	"zudomart/modules/ads/src/generated/ent/admonetizationpolicy"
	"zudomart/modules/ads/src/generated/ent/predicate"
)

const policyCacheLifetime = 30 * time.Second

type PolicySource struct {
	Client *ent.Client
	Now    func() time.Time
	mutex  sync.Mutex
	loaded time.Time
	rows   []MonetizationPolicyRow
	freq   map[string]FrequencyPolicy
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
	return source.seedMonetizationDefaults(ctx)
}

func (source *PolicySource) seedMonetizationDefaults(ctx context.Context) error {
	defaults := []struct {
		key, contentType string
		multiplier       int
	}{{"ads.original", ContentTypeOriginal, int(DefaultOriginalMultiplier)}, {"ads.ai_generated", ContentTypeAiGenerated, int(DefaultAiMultiplierBps)}}
	for _, entry := range defaults {
		exists, err := source.Client.AdMonetizationPolicy.Query().Where(adMonetizationKeyEquals(entry.key)).Exist(ctx)
		if err != nil || exists {
			if err != nil {
				return err
			}
			continue
		}
		if err := source.Client.AdMonetizationPolicy.Create().SetKey(entry.key).SetContentType(entry.contentType).SetCreatorShareBps(int(DefaultCreatorShareBps)).
			SetMultiplierBps(entry.multiplier).SetEffectiveFrom(source.Now().Add(-time.Hour)).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (source *PolicySource) MonetizationRows(ctx context.Context) ([]MonetizationPolicyRow, error) {
	if err := source.refreshWhenStale(ctx); err != nil {
		return nil, err
	}
	return source.rows, nil
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
	policies, err := source.Client.AdMonetizationPolicy.Query().All(ctx)
	if err != nil {
		return err
	}
	rows := make([]MonetizationPolicyRow, 0, len(policies))
	for _, policy := range policies {
		rows = append(rows, MonetizationPolicyRow{ContentType: policy.ContentType, CreatorShareBps: int64(policy.CreatorShareBps), MultiplierBps: int64(policy.MultiplierBps), EffectiveFrom: policy.EffectiveFrom, EffectiveTo: policy.EffectiveTo})
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
	source.rows, source.freq, source.loaded = rows, frequency, source.Now()
	return nil
}

func adFrequencyFormatEquals(format string) predicate.AdFrequencyPolicy {
	return adfrequencypolicy.Format(format)
}

func adMonetizationKeyEquals(key string) predicate.AdMonetizationPolicy {
	return admonetizationpolicy.Key(key)
}
