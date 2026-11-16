package services_test

import (
	"testing"
	"time"

	"nantty/modules/admin/src/modules/platformMetrics/services"
)

func TestMetricsWindowsCoverTheRequestedRangeInEvenBuckets(t *testing.T) {
	now := time.Date(2026, 10, 5, 14, 37, 0, 0, time.UTC)
	day, ok := services.ResolveMetricsWindow("24h", now)
	if !ok || day.Buckets != 24 || !day.Since.Equal(time.Date(2026, 10, 4, 15, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected 24h window %+v", day)
	}
	if index, inside := day.BucketIndex(now); !inside || index != 23 {
		t.Fatalf("now belongs to the last hourly bucket, got %d %v", index, inside)
	}
	week, _ := services.ResolveMetricsWindow("7d", now)
	if !week.Since.Equal(time.Date(2026, 9, 29, 0, 0, 0, 0, time.UTC)) || week.Buckets != 7 {
		t.Fatalf("unexpected 7d window %+v", week)
	}
	if _, inside := week.BucketIndex(week.Since.Add(-time.Second)); inside {
		t.Fatal("times before the window are outside")
	}
	month, _ := services.ResolveMetricsWindow("30d", now)
	if month.Buckets != 30 {
		t.Fatalf("unexpected 30d window %+v", month)
	}
	if _, ok := services.ResolveMetricsWindow("90d", now); ok {
		t.Fatal("unknown ranges are rejected")
	}
}
