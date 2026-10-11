package regionpricing

import (
	"math"
	"strings"
)

const LimitsBaseCurrency = "NGN"

var zeroDecimalCurrencies = map[string]bool{"XOF": true, "XAF": true, "UGX": true, "RWF": true, "JPY": true, "KRW": true}

func MinorUnitsPerMajor(currency string) int64 {
	if zeroDecimalCurrencies[strings.ToUpper(currency)] {
		return 1
	}
	return 100
}

func ConvertLimitFromBaseCurrency(amountMinor int64, currency string, ratesE8 map[string]int64) int64 {
	currency = strings.ToUpper(currency)
	if currency == LimitsBaseCurrency {
		return amountMinor
	}
	converted, err := ConvertMinorUnits(amountMinor, LimitsBaseCurrency, currency, ratesE8)
	if err != nil {
		return 0
	}
	return RoundLimitToSensibleUnit(converted, MinorUnitsPerMajor(currency))
}

func RoundLimitToSensibleUnit(amountMinor, minorPerMajor int64) int64 {
	if amountMinor <= 0 {
		return 0
	}
	major := float64(amountMinor) / float64(minorPerMajor)
	if major < 1 {
		return minorPerMajor
	}
	magnitude := math.Pow(10, math.Floor(math.Log10(major))-1)
	return int64(math.Round(major/magnitude)*magnitude) * minorPerMajor
}
