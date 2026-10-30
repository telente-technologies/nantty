package regionpricing

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

var (
	ErrInvalidStoreFeeSchedule   = errors.New("invalid store fee schedule")
	ErrStoreFeeScheduleMissing   = errors.New("no effective store fee schedule matches this purchase")
	ErrStoreFeeScheduleAmbiguous = errors.New("multiple equally specific store fee schedules match this purchase")
)

type StoreFeeSchedule struct {
	ID                    string    `json:"id"`
	Platform              string    `json:"platform"`
	CountryCode           string    `json:"countryCode"`
	ProgramCode           string    `json:"programCode"`
	InstallCohort         string    `json:"installCohort"`
	RecurringSubscription bool      `json:"recurringSubscription"`
	MinimumPaidMonths     int       `json:"minimumPaidMonths"`
	ServiceFeeBps         int64     `json:"serviceFeeBps"`
	BillingFeeBps         int64     `json:"billingFeeBps"`
	EffectiveFrom         time.Time `json:"effectiveFrom"`
	EffectiveUntil        time.Time `json:"effectiveUntil,omitempty"`
	SourceURL             string    `json:"sourceUrl"`
	RetrievedAt           time.Time `json:"retrievedAt"`
	Approved              bool      `json:"approved"`
}

type StoreFeeScheduleQuery struct {
	Platform              string
	CountryCode           string
	ProgramCode           string
	InstallCohort         string
	RecurringSubscription bool
	PaidMonths            int
	At                    time.Time
}

func ValidateStoreFeeSchedule(schedule StoreFeeSchedule) error {
	parsedURL, err := url.Parse(schedule.SourceURL)
	validSource := err == nil && parsedURL.Scheme == "https" && parsedURL.Host != ""
	switch {
	case strings.TrimSpace(schedule.ID) == "":
		return fmt.Errorf("%w: id is required", ErrInvalidStoreFeeSchedule)
	case schedule.Platform != "ios" && schedule.Platform != "android":
		return fmt.Errorf("%w: platform must be ios or android", ErrInvalidStoreFeeSchedule)
	case len(schedule.CountryCode) != 2 || strings.ToUpper(schedule.CountryCode) != schedule.CountryCode:
		return fmt.Errorf("%w: country code must be uppercase ISO alpha-2", ErrInvalidStoreFeeSchedule)
	case strings.TrimSpace(schedule.ProgramCode) == "" || strings.TrimSpace(schedule.InstallCohort) == "":
		return fmt.Errorf("%w: program and install cohort are required", ErrInvalidStoreFeeSchedule)
	case schedule.MinimumPaidMonths < 0:
		return fmt.Errorf("%w: minimum paid months cannot be negative", ErrInvalidStoreFeeSchedule)
	case schedule.ServiceFeeBps < 0 || schedule.BillingFeeBps < 0 || schedule.ServiceFeeBps >= 10_000 || schedule.BillingFeeBps >= 10_000 || schedule.ServiceFeeBps >= 10_000-schedule.BillingFeeBps:
		return fmt.Errorf("%w: combined service and billing fees must be below 100 percent", ErrInvalidStoreFeeSchedule)
	case schedule.EffectiveFrom.IsZero() || (!schedule.EffectiveUntil.IsZero() && !schedule.EffectiveUntil.After(schedule.EffectiveFrom)):
		return fmt.Errorf("%w: invalid effective interval", ErrInvalidStoreFeeSchedule)
	case !validSource || schedule.RetrievedAt.IsZero():
		return fmt.Errorf("%w: HTTPS source URL and retrieval time are required", ErrInvalidStoreFeeSchedule)
	default:
		return nil
	}
}

func ResolveStoreFeeSchedule(schedules []StoreFeeSchedule, query StoreFeeScheduleQuery) (StoreFeeSchedule, error) {
	if query.PaidMonths < 0 || query.At.IsZero() {
		return StoreFeeSchedule{}, ErrStoreFeeScheduleMissing
	}
	var selected StoreFeeSchedule
	found := false
	for _, candidate := range schedules {
		if !candidate.Approved || ValidateStoreFeeSchedule(candidate) != nil ||
			candidate.Platform != query.Platform || candidate.CountryCode != query.CountryCode ||
			candidate.ProgramCode != query.ProgramCode || candidate.InstallCohort != query.InstallCohort ||
			candidate.RecurringSubscription != query.RecurringSubscription || candidate.MinimumPaidMonths > query.PaidMonths ||
			query.At.Before(candidate.EffectiveFrom) || (!candidate.EffectiveUntil.IsZero() && !query.At.Before(candidate.EffectiveUntil)) {
			continue
		}
		if !found || candidate.EffectiveFrom.After(selected.EffectiveFrom) ||
			(candidate.EffectiveFrom.Equal(selected.EffectiveFrom) && candidate.MinimumPaidMonths > selected.MinimumPaidMonths) {
			selected, found = candidate, true
			continue
		}
		if candidate.EffectiveFrom.Equal(selected.EffectiveFrom) && candidate.MinimumPaidMonths == selected.MinimumPaidMonths {
			return StoreFeeSchedule{}, ErrStoreFeeScheduleAmbiguous
		}
	}
	if !found {
		return StoreFeeSchedule{}, ErrStoreFeeScheduleMissing
	}
	return selected, nil
}
