package services

import (
	"context"
	"fmt"
	"time"

	"nantty/modules/ads/src/interfaces"
)

const FrequencyPolicyAllFormats = "all"

type FrequencyPolicy struct {
	Format                   string
	SessionCap               int
	HourCap                  int
	DayCap                   int
	AdvertiserDayCap         int
	MinGapSlots              int
	CooldownSecondsAfterSkip int
}

type FrequencyScope struct {
	UserId              string
	SessionId           string
	Format              string
	AccountId           string
	AdGroupId           string
	GroupCapImpressions int
	GroupCapPerDays     int
	Now                 time.Time
}

type FrequencyVerdict struct {
	Allowed bool
	Reason  string
}

type FrequencyGuard struct {
	Store interfaces.CounterStore
}

type frequencyLimit struct {
	key    string
	cap    int
	reason string
}

func (guard FrequencyGuard) CheckUserExperienceGap(slotsSinceLastAd *int, policy FrequencyPolicy) FrequencyVerdict {
	if slotsSinceLastAd != nil && policy.MinGapSlots > 0 && *slotsSinceLastAd < policy.MinGapSlots {
		return FrequencyVerdict{Reason: "minimum_gap"}
	}
	return FrequencyVerdict{Allowed: true}
}

func (guard FrequencyGuard) IsCoolingDownAfterSkip(ctx context.Context, userId string) (bool, error) {
	value, err := guard.Store.Read(ctx, skipCooldownKey(userId))
	return value > 0, err
}

func (guard FrequencyGuard) RecordSkipCooldown(ctx context.Context, userId string, policy FrequencyPolicy) error {
	if policy.CooldownSecondsAfterSkip <= 0 {
		return nil
	}
	ttl := time.Duration(policy.CooldownSecondsAfterSkip) * time.Second
	if err := guard.Store.RaiseToAtLeast(ctx, skipCooldownKey(userId), 1, ttl); err != nil {
		return err
	}
	return nil
}

func (guard FrequencyGuard) Check(ctx context.Context, formatPolicy, totalPolicy FrequencyPolicy, scope FrequencyScope) (FrequencyVerdict, error) {
	limits := append(policyLimits(formatPolicy, scope, scope.Format), policyLimits(totalPolicy, scope, FrequencyPolicyAllFormats)...)
	limits = append(limits, frequencyLimit{key: advertiserDayKey(scope), cap: formatPolicy.AdvertiserDayCap, reason: "advertiser_day_cap"})
	if scope.GroupCapImpressions > 0 {
		limits = append(limits, frequencyLimit{key: adGroupWindowKey(scope), cap: scope.GroupCapImpressions, reason: "ad_group_cap"})
	}
	for _, limit := range limits {
		if limit.cap <= 0 {
			continue
		}
		used, err := guard.Store.Read(ctx, limit.key)
		if err != nil {
			return FrequencyVerdict{}, err
		}
		if used >= int64(limit.cap) {
			return FrequencyVerdict{Reason: limit.reason}, nil
		}
	}
	return FrequencyVerdict{Allowed: true}, nil
}

func (guard FrequencyGuard) Record(ctx context.Context, scope FrequencyScope) (bool, error) {
	for _, format := range []string{scope.Format, FrequencyPolicyAllFormats} {
		if err := guard.increment(ctx, sessionKey(scope, format), 12*time.Hour); err != nil {
			return false, err
		}
		if err := guard.increment(ctx, hourKey(scope, format), 2*time.Hour); err != nil {
			return false, err
		}
		if err := guard.increment(ctx, dayKey(scope, format), 26*time.Hour); err != nil {
			return false, err
		}
	}
	if err := guard.increment(ctx, advertiserDayKey(scope), 26*time.Hour); err != nil {
		return false, err
	}
	if scope.GroupCapImpressions > 0 {
		if err := guard.increment(ctx, adGroupWindowKey(scope), time.Duration(max(scope.GroupCapPerDays, 1))*24*time.Hour); err != nil {
			return false, err
		}
	}
	reach, err := guard.Store.Increment(ctx, reachKey(scope), 1, 26*time.Hour)
	return reach == 1, err
}

func (guard FrequencyGuard) increment(ctx context.Context, key string, ttl time.Duration) error {
	_, err := guard.Store.Increment(ctx, key, 1, ttl)
	return err
}

func policyLimits(policy FrequencyPolicy, scope FrequencyScope, format string) []frequencyLimit {
	return []frequencyLimit{
		{key: sessionKey(scope, format), cap: policy.SessionCap, reason: "session_cap_" + format},
		{key: hourKey(scope, format), cap: policy.HourCap, reason: "hour_cap_" + format},
		{key: dayKey(scope, format), cap: policy.DayCap, reason: "day_cap_" + format},
	}
}

func sessionKey(scope FrequencyScope, format string) string {
	return fmt.Sprintf("fc:s:%s:%s", scope.SessionId, format)
}

func hourKey(scope FrequencyScope, format string) string {
	return fmt.Sprintf("fc:h:%s:%s:%s", scope.UserId, scope.Now.UTC().Format("2006010215"), format)
}

func dayKey(scope FrequencyScope, format string) string {
	return fmt.Sprintf("fc:d:%s:%s:%s", scope.UserId, scope.Now.UTC().Format("20060102"), format)
}

func advertiserDayKey(scope FrequencyScope) string {
	return fmt.Sprintf("fc:a:%s:%s:%s:%s", scope.AccountId, scope.UserId, scope.Now.UTC().Format("20060102"), scope.Format)
}

func adGroupWindowKey(scope FrequencyScope) string {
	return fmt.Sprintf("fc:g:%s:%s", scope.AdGroupId, scope.UserId)
}

func reachKey(scope FrequencyScope) string {
	return fmt.Sprintf("fc:r:%s:%s:%s", scope.AdGroupId, scope.UserId, scope.Now.UTC().Format("20060102"))
}

func skipCooldownKey(userId string) string { return "fc:cooldown:" + userId }
