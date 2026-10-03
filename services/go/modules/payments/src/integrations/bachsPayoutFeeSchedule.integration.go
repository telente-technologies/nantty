package integrations

import (
	"strconv"
	"strings"
)

type PayoutFeeRule struct {
	FlatMinor int64
	Bps       int64
	MinMinor  int64
	CapMinor  int64
}

const anyOtherCurrencyKey = "*"

func DefaultBachsPayoutFeeRules() map[string]PayoutFeeRule {
	return map[string]PayoutFeeRule{
		"NGN":               {FlatMinor: 5_000},
		"USD":               {Bps: 100, MinMinor: 100, CapMinor: 1_500},
		anyOtherCurrencyKey: {Bps: 30},
	}
}

func (rule PayoutFeeRule) Quote(amountMinor int64) int64 {
	fee := rule.FlatMinor + (amountMinor*rule.Bps+9_999)/10_000
	if rule.MinMinor > 0 && fee < rule.MinMinor {
		fee = rule.MinMinor
	}
	if rule.CapMinor > 0 && fee > rule.CapMinor {
		fee = rule.CapMinor
	}
	return fee
}

func ParsePayoutFeeRules(raw string) map[string]PayoutFeeRule {
	rules := DefaultBachsPayoutFeeRules()
	for _, entry := range strings.Split(raw, ";") {
		currency, body, found := strings.Cut(strings.TrimSpace(entry), ":")
		currency = strings.ToUpper(strings.TrimSpace(currency))
		if !found || (currency != anyOtherCurrencyKey && len(currency) != 3) {
			continue
		}
		rule, valid := PayoutFeeRule{}, true
		for _, pair := range strings.Split(body, ",") {
			key, value, ok := strings.Cut(strings.TrimSpace(pair), "=")
			amount, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
			if !ok || err != nil || amount < 0 {
				valid = false
				break
			}
			switch strings.TrimSpace(key) {
			case "flat":
				rule.FlatMinor = amount
			case "bps":
				rule.Bps = amount
			case "min":
				rule.MinMinor = amount
			case "cap":
				rule.CapMinor = amount
			default:
				valid = false
			}
		}
		if valid {
			rules[currency] = rule
		}
	}
	return rules
}

func (settings BachsConnectSettings) payoutFeeRule(currency string) (PayoutFeeRule, bool) {
	if fee, configured := settings.PayoutFeeMinorByCurrency[currency]; configured {
		return PayoutFeeRule{FlatMinor: fee}, true
	}
	rules := settings.PayoutFeeRules
	if rules == nil {
		rules = DefaultBachsPayoutFeeRules()
	}
	if rule, ok := rules[currency]; ok {
		return rule, true
	}
	rule, ok := rules[anyOtherCurrencyKey]
	return rule, ok
}
