package services

import (
	"fmt"
	"time"

	"zudomart/platform/httpserver"
)

func PayoutAccountCoolingDown(cooldown time.Duration, withdrawableFrom time.Time) *httpserver.ApiError {
	failure := ErrPayoutAccountCoolingDown.WithDetails(map[string]any{"withdrawableFrom": withdrawableFrom.UTC().Format(time.RFC3339)})
	failure.Message = fmt.Sprintf("New payout accounts can receive withdrawals %s after they are added.", DescribeCooldown(cooldown))
	return failure
}

func DescribeCooldown(cooldown time.Duration) string {
	switch {
	case cooldown >= time.Hour && cooldown%time.Hour == 0:
		return plural(int64(cooldown/time.Hour), "hour")
	case cooldown >= time.Minute && cooldown%time.Minute == 0:
		return plural(int64(cooldown/time.Minute), "minute")
	case cooldown >= time.Hour:
		return plural(int64((cooldown+time.Hour-1)/time.Hour), "hour")
	}
	return plural(max(int64((cooldown+time.Minute-1)/time.Minute), 1), "minute")
}

func plural(count int64, unit string) string {
	if count == 1 {
		return "1 " + unit
	}
	return fmt.Sprintf("%d %ss", count, unit)
}
