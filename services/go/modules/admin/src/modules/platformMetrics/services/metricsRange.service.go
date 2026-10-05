package services

import "time"

type MetricsWindow struct {
	Name    string
	Since   time.Time
	Bucket  time.Duration
	Buckets int
}

func ResolveMetricsWindow(name string, now time.Time) (MetricsWindow, bool) {
	switch name {
	case "24h":
		start := now.UTC().Truncate(time.Hour).Add(-23 * time.Hour)
		return MetricsWindow{Name: name, Since: start, Bucket: time.Hour, Buckets: 24}, true
	case "7d", "30d":
		days := 7
		if name == "30d" {
			days = 30
		}
		today := time.Date(now.UTC().Year(), now.UTC().Month(), now.UTC().Day(), 0, 0, 0, 0, time.UTC)
		return MetricsWindow{Name: name, Since: today.AddDate(0, 0, 1-days), Bucket: 24 * time.Hour, Buckets: days}, true
	}
	return MetricsWindow{}, false
}

func (window MetricsWindow) BucketIndex(at time.Time) (int, bool) {
	if at.Before(window.Since) {
		return 0, false
	}
	index := int(at.Sub(window.Since) / window.Bucket)
	return index, index < window.Buckets
}
