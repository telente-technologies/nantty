package services

import (
	"time"

	"zudomart/modules/moderation/src/generated/ent"
)

const (
	StrikeLifetimeMonths     = 12
	WarningLifetimeMonths    = 6
	RepeatInfringerThreshold = 3
)

func ExpiryFor(kind string, now time.Time, overrideDays int) time.Time {
	if overrideDays > 0 {
		return now.AddDate(0, 0, overrideDays)
	}
	if kind == "warning" {
		return now.AddDate(0, WarningLifetimeMonths, 0)
	}
	return now.AddDate(0, StrikeLifetimeMonths, 0)
}

func StatusAt(row *ent.Strike, now time.Time) string {
	if row.RevokedAt != nil {
		return "revoked"
	}
	if row.ExpiresAt != nil && !row.ExpiresAt.After(now) {
		return "expired"
	}
	return "active"
}

func IsRepeatInfringer(activeStrikes int) bool {
	return activeStrikes >= RepeatInfringerThreshold
}

func AdminSource(source string) string {
	switch source {
	case "copyright":
		return "COPYRIGHT"
	case "manual":
		return "MANUAL"
	}
	return "MODERATION"
}

func ReferenceKey(referenceType, referenceId, kind string) *string {
	if referenceId == "" {
		return nil
	}
	key := referenceType + ":" + referenceId + ":" + kind
	return &key
}
