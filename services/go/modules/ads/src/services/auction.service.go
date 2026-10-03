package services

import (
	"cmp"
	"slices"
)

const (
	BasisCpm = "cpm"
	BasisCpc = "cpc"

	minimumQualityBps = 5_000
	maximumQualityBps = 20_000
)

type AuctionCandidate struct {
	AdId          string
	Basis         string
	BidMinor      int64
	PctrPpm       int64
	BaselinePpm   int64
	ReserveMicros int64
}

type AuctionOutcome struct {
	WinnerAdId        string
	Basis             string
	ClearingMicros    int64
	ClearingEcpmMicro int64
	CandidatesCounted int
}

type scoredCandidate struct {
	candidate   AuctionCandidate
	ecpmMicros  int64
	qualityBps  int64
	scoreMicros int64
}

func expectedRevenuePerThousandInMicros(candidate AuctionCandidate) int64 {
	if candidate.Basis == BasisCpc {
		return candidate.BidMinor * candidate.PctrPpm * 1_000
	}
	return candidate.BidMinor * 1_000_000
}

func qualityMultiplierBps(candidate AuctionCandidate) int64 {
	if candidate.Basis == BasisCpc || candidate.BaselinePpm <= 0 {
		return 10_000
	}
	return min(max(candidate.PctrPpm*10_000/candidate.BaselinePpm, minimumQualityBps), maximumQualityBps)
}

func RunSecondPriceAuction(candidates []AuctionCandidate) (AuctionOutcome, bool) {
	scored := make([]scoredCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate.BidMinor <= 0 || candidate.PctrPpm <= 0 {
			continue
		}
		ecpm := expectedRevenuePerThousandInMicros(candidate)
		if ecpm < candidate.ReserveMicros {
			continue
		}
		quality := qualityMultiplierBps(candidate)
		scored = append(scored, scoredCandidate{candidate: candidate, ecpmMicros: ecpm, qualityBps: quality, scoreMicros: ecpm * quality / 10_000})
	}
	if len(scored) == 0 {
		return AuctionOutcome{}, false
	}
	slices.SortFunc(scored, func(left, right scoredCandidate) int {
		if byScore := cmp.Compare(right.scoreMicros, left.scoreMicros); byScore != 0 {
			return byScore
		}
		return cmp.Compare(left.candidate.AdId, right.candidate.AdId)
	})
	winner := scored[0]
	reserve := min(winner.candidate.ReserveMicros, winner.ecpmMicros)
	clearingEcpm := reserve
	if len(scored) > 1 {
		beatRunnerUp := scored[1].scoreMicros*10_000/winner.qualityBps + 1
		clearingEcpm = min(max(beatRunnerUp, reserve), winner.ecpmMicros)
	}
	return AuctionOutcome{
		WinnerAdId: winner.candidate.AdId, Basis: winner.candidate.Basis,
		ClearingMicros: priceMicrosPerChargeableEvent(winner, clearingEcpm), ClearingEcpmMicro: clearingEcpm, CandidatesCounted: len(scored),
	}, true
}

func priceMicrosPerChargeableEvent(winner scoredCandidate, clearingEcpmMicros int64) int64 {
	if winner.candidate.Basis == BasisCpc {
		perClick := ceilDivide(clearingEcpmMicros*1_000, winner.candidate.PctrPpm)
		return min(perClick, winner.candidate.BidMinor*1_000_000)
	}
	return min(ceilDivide(clearingEcpmMicros, 1_000), winner.candidate.BidMinor*1_000)
}

func ceilDivide(numerator, denominator int64) int64 {
	if denominator <= 0 {
		return 0
	}
	return (numerator + denominator - 1) / denominator
}
