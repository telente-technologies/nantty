package models

import "time"

type ProrationInput struct {
	CurrentPeriodPaidMinor int64
	NewPeriodPriceMinor    int64
	PeriodStartsAt         time.Time
	PeriodEndsAt           time.Time
	Now                    time.Time
	RestartPeriod          bool
}

type ProrationResult struct {
	UnusedCreditMinor int64
	ChargeNowMinor    int64
	LeftoverCredit    int64
}

func remainingShare(amountMinor int64, remaining, total time.Duration) int64 {
	if total <= 0 || remaining <= 0 || amountMinor <= 0 {
		return 0
	}
	if remaining >= total {
		return amountMinor
	}
	return amountMinor * int64(remaining/time.Second) / int64(total/time.Second)
}

func ProrateUpgrade(input ProrationInput) ProrationResult {
	total := input.PeriodEndsAt.Sub(input.PeriodStartsAt)
	remaining := input.PeriodEndsAt.Sub(input.Now)
	unused := remainingShare(input.CurrentPeriodPaidMinor, remaining, total)
	due := input.NewPeriodPriceMinor
	if !input.RestartPeriod {
		due = input.NewPeriodPriceMinor - remainingShare(input.NewPeriodPriceMinor, total-remaining, total)
	}
	result := ProrationResult{UnusedCreditMinor: unused, ChargeNowMinor: due - unused}
	if result.ChargeNowMinor < 0 {
		result.LeftoverCredit, result.ChargeNowMinor = -result.ChargeNowMinor, 0
	}
	return result
}

func MonthlyEquivalent(periodPriceMinor int64, interval string) int64 {
	if interval == "year" {
		return periodPriceMinor / 12
	}
	return periodPriceMinor
}

func IsUpgrade(currentMonthlyMinor int64, currentInterval string, nextMonthlyMinor int64, nextInterval string) bool {
	if nextMonthlyMinor != currentMonthlyMinor {
		return nextMonthlyMinor > currentMonthlyMinor
	}
	return currentInterval == "month" && nextInterval == "year"
}
