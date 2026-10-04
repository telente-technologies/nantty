package services

import (
	"time"

	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/strike"
	copyrightservices "zudomart/modules/moderation/src/modules/copyrightClaims/services"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
)

const (
	StatusGoodStanding = "GOOD_STANDING"
	StatusAtRisk       = "AT_RISK"
	StatusRestricted   = "RESTRICTED"
)

var CopyrightRestrictions = []string{"MONETISATION", "GOING_LIVE"}

type StandingInput struct {
	CopyrightStrikesInWindow int
	ActiveStrikes            int
	PendingTakedowns         int
}

type Standing struct {
	Status                string   `json:"status"`
	Restrictions          []string `json:"restrictions"`
	NeedsSuspensionReview bool     `json:"needsSuspensionReview"`
	CanMonetise           bool     `json:"canMonetise"`
	CanGoLive             bool     `json:"canGoLive"`
}

func ComputeStanding(input StandingInput, settings copyrightservices.PolicySettings) Standing {
	restricted := input.CopyrightStrikesInWindow >= settings.RestrictionThreshold || strikeservices.IsRepeatInfringer(input.ActiveStrikes)
	standing := Standing{Status: StatusGoodStanding, Restrictions: []string{}, CanMonetise: true, CanGoLive: true, NeedsSuspensionReview: input.CopyrightStrikesInWindow >= settings.SuspensionReviewThreshold}
	switch {
	case restricted:
		standing.Status, standing.Restrictions, standing.CanMonetise, standing.CanGoLive = StatusRestricted, append([]string{}, CopyrightRestrictions...), false, false
	case input.ActiveStrikes > 0 || input.PendingTakedowns > 0:
		standing.Status = StatusAtRisk
	}
	return standing
}

func IsActiveAt(row *ent.Strike, now time.Time) bool {
	return strikeservices.StatusAt(row, now) == "active"
}

func CountActiveStrikes(rows []*ent.Strike, now time.Time) int {
	count := 0
	for _, row := range rows {
		if row.Kind == strike.KindStrike && IsActiveAt(row, now) {
			count++
		}
	}
	return count
}

func CountCopyrightStrikesInWindow(rows []*ent.Strike, now time.Time, windowDays int) int {
	windowStart := now.AddDate(0, 0, -windowDays)
	count := 0
	for _, row := range rows {
		if row.Kind == strike.KindStrike && row.Source == strike.SourceCopyright && IsActiveAt(row, now) && !row.CreatedAt.Before(windowStart) {
			count++
		}
	}
	return count
}
