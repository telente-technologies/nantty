package services

import (
	"fmt"
	"math"

	"zudomart/modules/ads/src/types"
)

const winnerConfidencePercent = 90

type ArmTotals struct {
	AdSetId   string
	AdSetName string
	Totals    DeliveryTotals
}

func lowerIsBetter(metric string) bool { return metric == "cost_per_result" }

func successes(metric string, totals DeliveryTotals) int64 {
	if metric == "ctr" {
		return totals.Clicks
	}
	if totals.Conversions > 0 {
		return totals.Conversions
	}
	return totals.Clicks
}

func armScore(metric string, totals DeliveryTotals) (float64, bool) {
	if metric == "conversions" {
		return float64(totals.Conversions), totals.Impressions > 0
	}
	return MetricValue(metric, totals)
}

func DecideExperiment(metric string, arms []ArmTotals) types.ExperimentResult {
	best, runnerUp := -1, -1
	scores := make([]float64, len(arms))
	for index, arm := range arms {
		score, defined := armScore(metric, arm.Totals)
		if !defined {
			continue
		}
		scores[index] = score
		switch {
		case best < 0 || better(metric, score, scores[best]):
			best, runnerUp = index, best
		case runnerUp < 0 || better(metric, score, scores[runnerUp]):
			runnerUp = index
		}
	}
	if best < 0 || runnerUp < 0 {
		return types.ExperimentResult{Summary: "Not enough delivery to compare the ad sets."}
	}
	confidence := proportionConfidence(successes(metric, arms[best].Totals), arms[best].Totals.Impressions, successes(metric, arms[runnerUp].Totals), arms[runnerUp].Totals.Impressions)
	if confidence < winnerConfidencePercent {
		return types.ExperimentResult{ConfidencePercent: confidence, Summary: fmt.Sprintf("No clear winner yet: %d%% confidence.", confidence)}
	}
	winner := arms[best].AdSetId
	return types.ExperimentResult{WinnerAdSetId: &winner, ConfidencePercent: confidence, Summary: fmt.Sprintf("%s performed best with %d%% confidence.", arms[best].AdSetName, confidence)}
}

func better(metric string, candidate, current float64) bool {
	if lowerIsBetter(metric) {
		return candidate < current
	}
	return candidate > current
}

func proportionConfidence(successesA, trialsA, successesB, trialsB int64) int {
	if trialsA == 0 || trialsB == 0 {
		return 0
	}
	rateA, rateB := float64(successesA)/float64(trialsA), float64(successesB)/float64(trialsB)
	pooled := float64(successesA+successesB) / float64(trialsA+trialsB)
	deviation := math.Sqrt(pooled * (1 - pooled) * (1/float64(trialsA) + 1/float64(trialsB)))
	if deviation == 0 {
		return 0
	}
	z := math.Abs(rateA-rateB) / deviation
	return int(math.Round((math.Erf(z / math.Sqrt2)) * 100))
}
