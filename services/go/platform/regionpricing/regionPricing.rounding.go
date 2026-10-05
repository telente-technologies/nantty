package regionpricing

func roundUpToStep(amountMinor, stepMinor int64) int64 {
	if stepMinor <= 0 || amountMinor%stepMinor == 0 {
		return amountMinor
	}
	return (amountMinor/stepMinor + 1) * stepMinor
}

func RoundToPricePoint(amountMinor int64, currency string) int64 {
	if amountMinor <= 0 {
		return 0
	}
	switch currency {
	case "NGN":
		if amountMinor >= 1_000_000 {
			return roundUpToStep(amountMinor, 50_000)
		}
		return roundUpToStep(amountMinor, 10_000)
	case "KES":
		if amountMinor >= 100_000 {
			return roundUpToStep(amountMinor, 5_000)
		}
		return roundUpToStep(amountMinor, 1_000)
	case "GHS":
		return roundUpToStep(amountMinor, 100)
	default:
		if amountMinor < 1_000 {
			return roundUpToStep(amountMinor+1, 10) - 1
		}
		return roundUpToStep(amountMinor+1, 100) - 1
	}
}

func YearlyFromMonthly(monthlyMinor, yearlyDiscountBps int64, currency string) int64 {
	full := monthlyMinor * 12
	return RoundToPricePoint(full-(full*yearlyDiscountBps+5_000)/10_000, currency)
}
