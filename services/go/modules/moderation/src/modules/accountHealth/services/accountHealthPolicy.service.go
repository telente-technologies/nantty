package services

import (
	"slices"
	"time"

	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/strike"
	copyrightservices "nantty/modules/moderation/src/modules/copyrightClaims/services"
	strikeservices "nantty/modules/moderation/src/modules/strikes/services"
)

const (
	StatusGoodStanding = "GOOD_STANDING"
	StatusAtRisk       = "AT_RISK"
	StatusRestricted   = "RESTRICTED"
)

const (
	RestrictionMonetisation = "MONETISATION"
	OverrideModeAllow       = "allow"
	OverrideModePause       = "pause"
)

const (
	PauseReasonActiveStrikes    = "ACTIVE_STRIKES"
	PauseReasonCopyrightStrikes = "COPYRIGHT_STRIKES"
	PauseReasonStaffOverride    = "STAFF_OVERRIDE"
)

var CopyrightRestrictions = []string{RestrictionMonetisation, "GOING_LIVE"}

type MonetisationOverride struct {
	Mode                        string
	ActiveStrikeCountAtOverride int
	Reason                      string
	ActorId                     string
	ActorName                   string
	SetAt                       time.Time
}

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
	MonetisationPause     *string  `json:"monetisationPauseReason"`
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
	if !standing.CanMonetise {
		standing.MonetisationPause = pauseReasonFor(input)
	}
	return standing
}

func pauseReasonFor(input StandingInput) *string {
	reason := PauseReasonCopyrightStrikes
	if strikeservices.IsRepeatInfringer(input.ActiveStrikes) {
		reason = PauseReasonActiveStrikes
	}
	return &reason
}

func MonetisationOverrideStillApplies(override *MonetisationOverride, activeStrikes int) bool {
	if override == nil {
		return false
	}
	return override.Mode == OverrideModePause || (override.Mode == OverrideModeAllow && activeStrikes <= override.ActiveStrikeCountAtOverride)
}

func ApplyMonetisationOverride(standing Standing, override *MonetisationOverride, activeStrikes int) Standing {
	if !MonetisationOverrideStillApplies(override, activeStrikes) {
		return standing
	}
	restrictions := slices.DeleteFunc(append([]string{}, standing.Restrictions...), func(restriction string) bool { return restriction == RestrictionMonetisation })
	if override.Mode == OverrideModePause {
		reason := PauseReasonStaffOverride
		standing.CanMonetise, standing.MonetisationPause, standing.Status = false, &reason, StatusRestricted
		standing.Restrictions = append([]string{RestrictionMonetisation}, restrictions...)
		return standing
	}
	standing.CanMonetise, standing.MonetisationPause, standing.Restrictions = true, nil, restrictions
	if standing.Status == StatusRestricted && len(restrictions) == 0 {
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
