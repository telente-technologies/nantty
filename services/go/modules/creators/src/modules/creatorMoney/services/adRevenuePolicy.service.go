package services

import "encoding/json"

type AdRevenueRuleView struct {
	ContentType               string `json:"contentType"`
	MultiplierBasisPoints     int64  `json:"multiplierBasisPoints"`
	EffectiveShareBasisPoints int64  `json:"effectiveShareBasisPoints"`
}

type AdRevenuePolicyView struct {
	BaseShareBasisPoints int64               `json:"baseShareBasisPoints"`
	Rules                []AdRevenueRuleView `json:"rules"`
	CalculationNote      string              `json:"calculationNote"`
}

func BuildAdRevenuePolicy(raw json.RawMessage, found bool, creatorShareBps int64) AdRevenuePolicyView {
	if creatorShareBps < 0 {
		creatorShareBps = 0
	}
	if creatorShareBps > 10_000 {
		creatorShareBps = 10_000
	}
	multipliers := map[string]int64{"original": 10_000, "ai_generated": 3_000}
	if found {
		var setting struct {
			Rows []struct {
				Id            string `json:"id"`
				MultiplierBps int64  `json:"multiplierBps"`
				Active        bool   `json:"active"`
			} `json:"rows"`
		}
		if json.Unmarshal(raw, &setting) == nil {
			for _, row := range setting.Rows {
				if row.Active && row.MultiplierBps >= 0 && row.MultiplierBps <= 30_000 {
					if _, supported := multipliers[row.Id]; supported {
						multipliers[row.Id] = row.MultiplierBps
					}
				}
			}
		}
	}
	rules := make([]AdRevenueRuleView, 0, len(multipliers))
	for _, contentType := range []string{"original", "ai_generated"} {
		multiplier := multipliers[contentType]
		effective := creatorShareBps * multiplier / 10_000
		if effective > 10_000 {
			effective = 10_000
		}
		rules = append(rules, AdRevenueRuleView{ContentType: contentType, MultiplierBasisPoints: multiplier, EffectiveShareBasisPoints: effective})
	}
	return AdRevenuePolicyView{
		BaseShareBasisPoints: creatorShareBps,
		Rules:                rules,
		CalculationNote:      "The effective share applies to eligible, actually delivered and settled ad revenue. It is not a fixed payment per view or impression; final earnings depend on valid delivery, settlement and adjustments.",
	}
}
