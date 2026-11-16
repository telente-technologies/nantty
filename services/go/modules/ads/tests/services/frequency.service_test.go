package services_test

import (
	"context"
	"testing"
	"time"

	"nantty/modules/ads/src/integrations"
	"nantty/modules/ads/src/services"
)

func newGuard(now time.Time) (services.FrequencyGuard, *time.Time) {
	clock := now
	return services.FrequencyGuard{Store: integrations.NewMemoryCounterStore(func() time.Time { return clock })}, &clock
}

func scopeAt(now time.Time) services.FrequencyScope {
	return services.FrequencyScope{UserId: "u1", SessionId: "s1", Format: "feed", AccountId: "acc1", AdGroupId: "g1", Now: now}
}

func TestFrequencySessionCapBlocksAfterLimitPerFormat(t *testing.T) {
	now := time.Date(2026, 10, 3, 10, 0, 0, 0, time.UTC)
	guard, _ := newGuard(now)
	feed := services.FrequencyPolicy{Format: "feed", SessionCap: 2, HourCap: 50, DayCap: 50, AdvertiserDayCap: 50}
	total := services.FrequencyPolicy{Format: "all", SessionCap: 10, HourCap: 50, DayCap: 50}
	ctx := context.Background()
	for range 2 {
		verdict, err := guard.Check(ctx, feed, total, scopeAt(now))
		if err != nil || !verdict.Allowed {
			t.Fatalf("expected allowed, got %+v %v", verdict, err)
		}
		_, _ = guard.Record(ctx, scopeAt(now))
	}
	verdict, _ := guard.Check(ctx, feed, total, scopeAt(now))
	if verdict.Allowed || verdict.Reason != "session_cap_feed" {
		t.Fatalf("third impression must hit the session cap, got %+v", verdict)
	}
	clipScope := scopeAt(now)
	clipScope.Format = "clips"
	clips := services.FrequencyPolicy{Format: "clips", SessionCap: 2, HourCap: 50, DayCap: 50, AdvertiserDayCap: 50}
	if verdict, _ := guard.Check(ctx, clips, total, clipScope); !verdict.Allowed {
		t.Fatal("another format has its own session counter")
	}
}

func TestFrequencyHourDayAndAdvertiserCapsResetWithTheirWindows(t *testing.T) {
	now := time.Date(2026, 10, 3, 10, 30, 0, 0, time.UTC)
	guard, clock := newGuard(now)
	policy := services.FrequencyPolicy{Format: "feed", SessionCap: 99, HourCap: 1, DayCap: 3, AdvertiserDayCap: 2}
	total := services.FrequencyPolicy{Format: "all"}
	ctx := context.Background()
	_, _ = guard.Record(ctx, scopeAt(now))
	if verdict, _ := guard.Check(ctx, policy, total, scopeAt(now)); verdict.Reason != "hour_cap_feed" {
		t.Fatalf("expected hour cap, got %+v", verdict)
	}
	*clock = now.Add(time.Hour)
	next := scopeAt(*clock)
	if verdict, _ := guard.Check(ctx, policy, total, next); !verdict.Allowed {
		t.Fatalf("next hour must be free, got %+v", verdict)
	}
	_, _ = guard.Record(ctx, next)
	otherGroup := next
	otherGroup.AdGroupId = "g2"
	if verdict, _ := guard.Check(ctx, policy, total, otherGroup); verdict.Reason != "advertiser_day_cap" && verdict.Reason != "hour_cap_feed" {
		t.Fatalf("advertiser cap applies across ad groups, got %+v", verdict)
	}
}

func TestFrequencyAdGroupWindowCapAndNewReachSignal(t *testing.T) {
	now := time.Date(2026, 10, 3, 10, 0, 0, 0, time.UTC)
	guard, _ := newGuard(now)
	scope := scopeAt(now)
	scope.GroupCapImpressions, scope.GroupCapPerDays = 2, 7
	policy := services.FrequencyPolicy{Format: "feed", SessionCap: 99, HourCap: 99, DayCap: 99, AdvertiserDayCap: 99}
	ctx := context.Background()
	newReach, _ := guard.Record(ctx, scope)
	again, _ := guard.Record(ctx, scope)
	if !newReach || again {
		t.Fatalf("only the first impression of the day is new reach: %v %v", newReach, again)
	}
	if verdict, _ := guard.Check(ctx, policy, services.FrequencyPolicy{}, scope); verdict.Reason != "ad_group_cap" {
		t.Fatalf("expected ad group cap, got %+v", verdict)
	}
}

func TestFrequencyMinimumGapAndSkipCooldown(t *testing.T) {
	now := time.Date(2026, 10, 3, 10, 0, 0, 0, time.UTC)
	guard, clock := newGuard(now)
	policy := services.FrequencyPolicy{MinGapSlots: 4, CooldownSecondsAfterSkip: 600}
	tooSoon, farEnough := 2, 4
	if guard.CheckUserExperienceGap(&tooSoon, policy).Allowed || !guard.CheckUserExperienceGap(&farEnough, policy).Allowed || !guard.CheckUserExperienceGap(nil, policy).Allowed {
		t.Fatal("minimum gap not enforced as configured")
	}
	ctx := context.Background()
	_ = guard.RecordSkipCooldown(ctx, "u1", policy)
	if cooling, _ := guard.IsCoolingDownAfterSkip(ctx, "u1"); !cooling {
		t.Fatal("expected cooldown after a skip")
	}
	*clock = now.Add(11 * time.Minute)
	if cooling, _ := guard.IsCoolingDownAfterSkip(ctx, "u1"); cooling {
		t.Fatal("cooldown should have expired")
	}
}
