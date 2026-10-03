package services

import "time"

type PacingInput struct {
	Now                 time.Time
	DayStart            time.Time
	DayEnd              time.Time
	BudgetType          string
	BudgetMicros        int64
	SpentTodayMicros    int64
	SpentLifetimeMicros int64
	ScheduleEnd         *time.Time
	BurstBps            int64
	MinimumUpfrontBps   int64
}

type PacingDecision struct {
	Deliver bool
	Reason  string
}

func DecidePacing(input PacingInput) PacingDecision {
	if input.BudgetMicros <= 0 {
		return PacingDecision{Deliver: true}
	}
	dailyBudget, exhausted := resolveDailyBudgetMicros(input)
	if exhausted {
		return PacingDecision{Reason: "lifetime_budget_exhausted"}
	}
	if input.SpentTodayMicros >= dailyBudget {
		return PacingDecision{Reason: "daily_budget_exhausted"}
	}
	if input.SpentTodayMicros >= allowedSpendNowMicros(input, dailyBudget) {
		return PacingDecision{Reason: "paced"}
	}
	return PacingDecision{Deliver: true}
}

func resolveDailyBudgetMicros(input PacingInput) (int64, bool) {
	if input.BudgetType != "lifetime" {
		return input.BudgetMicros, false
	}
	remaining := input.BudgetMicros - input.SpentLifetimeMicros
	if remaining <= 0 {
		return 0, true
	}
	remainingDays := int64(1)
	if input.ScheduleEnd != nil {
		untilEnd := input.ScheduleEnd.Sub(input.DayStart)
		remainingDays = max(1, int64((untilEnd+24*time.Hour-1)/(24*time.Hour)))
	}
	spentBeforeToday := max(0, input.SpentLifetimeMicros-input.SpentTodayMicros)
	remainingAtDayStart := input.BudgetMicros - spentBeforeToday
	return ceilDivide(remainingAtDayStart, remainingDays), false
}

func allowedSpendNowMicros(input PacingInput, dailyBudget int64) int64 {
	dayLength := input.DayEnd.Sub(input.DayStart)
	if dayLength <= 0 {
		return dailyBudget
	}
	elapsed := min(max(input.Now.Sub(input.DayStart), 0), dayLength)
	burst := max(input.BurstBps, 10_000)
	elapsedBps := int64(elapsed) * 10_000 / int64(dayLength)
	evenlyPaced := dailyBudget * elapsedBps / 10_000 * burst / 10_000
	upfront := dailyBudget * input.MinimumUpfrontBps / 10_000
	return min(max(evenlyPaced, upfront), dailyBudget)
}

func DayWindowInLocation(now time.Time, location *time.Location) (time.Time, time.Time) {
	local := now.In(location)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
	return start, start.AddDate(0, 0, 1)
}
