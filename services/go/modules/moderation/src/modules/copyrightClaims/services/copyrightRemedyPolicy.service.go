package services

import (
	"context"
	"slices"
	"time"

	"nantty/modules/moderation/src/generated/ent"
)

const (
	RemedyAudioMuted      = "audio_muted"
	RemedyTakedownWarning = "takedown_warning"
	RemedyTakenDown       = "taken_down"
)

type PolicySettings struct {
	TakedownDeadlineHours     int    `json:"takedownDeadlineHours"`
	StrikeLifetimeDays        int    `json:"strikeLifetimeDays"`
	WarningLifetimeDays       int    `json:"warningLifetimeDays"`
	StrikeWindowDays          int    `json:"strikeWindowDays"`
	RestrictionThreshold      int    `json:"restrictionThreshold"`
	SuspensionReviewThreshold int    `json:"suspensionReviewThreshold"`
	RestrictionDays           int    `json:"restrictionDays"`
	UpdatedBy                 string `json:"updatedBy"`
	UpdatedAt                 string `json:"updatedAt,omitempty"`
}

// Nigeria's Copyright Act 2022 requires a warning, then at least a one-month suspension for a repeat infringer.
const (
	LegalRepeatInfringerThreshold = 2
	LegalMinimumSuspensionDays    = 30
)

func DefaultPolicySettings() PolicySettings {
	return PolicySettings{TakedownDeadlineHours: 48, StrikeLifetimeDays: 365, WarningLifetimeDays: 365, StrikeWindowDays: 365, RestrictionThreshold: LegalRepeatInfringerThreshold, SuspensionReviewThreshold: 3, RestrictionDays: LegalMinimumSuspensionDays}
}

func withLegalFloor(settings PolicySettings) PolicySettings {
	settings.RestrictionThreshold = min(settings.RestrictionThreshold, LegalRepeatInfringerThreshold)
	settings.RestrictionDays = max(settings.RestrictionDays, LegalMinimumSuspensionDays)
	return settings
}

func LoadPolicySettings(ctx context.Context, client *ent.Client) (PolicySettings, error) {
	row, err := client.CopyrightPolicySetting.Query().First(ctx)
	if ent.IsNotFound(err) {
		return DefaultPolicySettings(), nil
	}
	if err != nil {
		return PolicySettings{}, err
	}
	return withLegalFloor(PolicySettings{
		TakedownDeadlineHours: row.TakedownDeadlineHours, StrikeLifetimeDays: row.StrikeLifetimeDays, WarningLifetimeDays: row.WarningLifetimeDays, StrikeWindowDays: row.StrikeWindowDays,
		RestrictionThreshold: row.RestrictionThreshold, SuspensionReviewThreshold: row.SuspensionReviewThreshold, RestrictionDays: row.RestrictionDays, UpdatedBy: row.UpdatedBy, UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339),
	}), nil
}

func ValidatePolicySettings(settings PolicySettings) (string, bool) {
	checks := []struct {
		field         string
		value, lo, hi int
	}{
		{"takedownDeadlineHours", settings.TakedownDeadlineHours, 1, 720},
		{"strikeLifetimeDays", settings.StrikeLifetimeDays, 7, 730},
		{"warningLifetimeDays", settings.WarningLifetimeDays, 7, 730},
		{"strikeWindowDays", settings.StrikeWindowDays, 7, 730},
		{"restrictionThreshold", settings.RestrictionThreshold, 1, LegalRepeatInfringerThreshold},
		{"suspensionReviewThreshold", settings.SuspensionReviewThreshold, 1, 20},
		{"restrictionDays", settings.RestrictionDays, LegalMinimumSuspensionDays, 90},
	}
	for _, check := range checks {
		if check.value < check.lo || check.value > check.hi {
			return check.field, false
		}
	}
	return "", true
}

func RemedyForUpheldClaim(claimScope, targetType string, hasKnownUploader bool) string {
	if targetType == "live" || !hasKnownUploader {
		return RemedyTakenDown
	}
	if claimScope == "audio" && slices.Contains([]string{"clip", "post", "sound"}, targetType) {
		return RemedyAudioMuted
	}
	return RemedyTakedownWarning
}

func TakedownDeadlineFrom(decidedAt time.Time, settings PolicySettings) time.Time {
	return decidedAt.Add(time.Duration(settings.TakedownDeadlineHours) * time.Hour)
}

func IsTakedownOverdue(remedyState string, status string, deadline *time.Time, now time.Time) bool {
	return remedyState == "awaiting_removal" && status == "upheld" && deadline != nil && !deadline.After(now)
}

func CanRecordVoluntaryRemoval(remedyState string, deadline *time.Time, removedAt time.Time) bool {
	return remedyState == "awaiting_removal" && deadline != nil && removedAt.Before(*deadline)
}
