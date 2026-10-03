package services

import (
	"context"
	"time"

	"zudomart/modules/moderation/src/generated/ent"
)

const (
	DefaultRetentionDays = 180
	DefaultLegalHoldDays = 730
)

func LoadRetentionSettings(ctx context.Context, client *ent.Client) (retentionDays, legalHoldDays int, err error) {
	row, err := client.EvidenceRetentionSetting.Query().First(ctx)
	if ent.IsNotFound(err) {
		return DefaultRetentionDays, DefaultLegalHoldDays, nil
	}
	if err != nil {
		return 0, 0, err
	}
	return row.RetentionDays, row.LegalHoldDays, nil
}

func RetainedUntil(now time.Time, days int) time.Time {
	return now.Add(time.Duration(days) * 24 * time.Hour)
}
