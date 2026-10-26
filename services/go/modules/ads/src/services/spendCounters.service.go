package services

import (
	"context"
	"fmt"
	"time"

	"nantty/modules/ads/src/interfaces"
)

const spendCounterLifetimeTtl = 800 * 24 * time.Hour

type SpendCounters struct {
	Store interfaces.CounterStore
}

type SpendScope struct {
	AccountId  string
	CampaignId string
	AdGroupId  string
	Day        string
	Month      string
}

type SpendReading struct {
	GroupToday       int64
	GroupLifetime    int64
	CampaignToday    int64
	CampaignLifetime int64
	AccountMonth     int64
}

func DayKeyInTimezone(at time.Time, timezone string) string {
	location, err := time.LoadLocation(timezone)
	if err != nil {
		location = time.UTC
	}
	return at.In(location).Format("2006-01-02")
}

func (counters SpendCounters) Add(ctx context.Context, scope SpendScope, micros int64) error {
	for _, target := range []struct {
		key string
		ttl time.Duration
	}{
		{spendKey("g", scope.AdGroupId, scope.Day), 3 * 24 * time.Hour},
		{spendKey("g", scope.AdGroupId, "life"), spendCounterLifetimeTtl},
		{spendKey("c", scope.CampaignId, scope.Day), 3 * 24 * time.Hour},
		{spendKey("c", scope.CampaignId, "life"), spendCounterLifetimeTtl},
		{spendKey("a", scope.AccountId, scope.Month), 40 * 24 * time.Hour},
	} {
		if _, err := counters.Store.Increment(ctx, target.key, micros, target.ttl); err != nil {
			return err
		}
	}
	return nil
}

func (counters SpendCounters) Read(ctx context.Context, scope SpendScope) (SpendReading, error) {
	var reading SpendReading
	targets := []struct {
		key    string
		target *int64
	}{
		{spendKey("g", scope.AdGroupId, scope.Day), &reading.GroupToday},
		{spendKey("g", scope.AdGroupId, "life"), &reading.GroupLifetime},
		{spendKey("c", scope.CampaignId, scope.Day), &reading.CampaignToday},
		{spendKey("c", scope.CampaignId, "life"), &reading.CampaignLifetime},
		{spendKey("a", scope.AccountId, scope.Month), &reading.AccountMonth},
	}
	for _, entry := range targets {
		value, err := counters.Store.Read(ctx, entry.key)
		if err != nil {
			return SpendReading{}, err
		}
		*entry.target = value
	}
	return reading, nil
}

func (counters SpendCounters) SeedAtLeast(ctx context.Context, kind, id, suffix string, micros int64, ttl time.Duration) error {
	return counters.Store.RaiseToAtLeast(ctx, spendKey(kind, id, suffix), micros, ttl)
}

func spendKey(kind, id, suffix string) string { return fmt.Sprintf("sp:%s:%s:%s", kind, id, suffix) }
