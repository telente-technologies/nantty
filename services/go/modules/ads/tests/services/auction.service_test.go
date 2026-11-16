package services_test

import (
	"testing"

	"nantty/modules/ads/src/services"
)

func cpmCandidate(id string, bidMinor, pctr int64) services.AuctionCandidate {
	return services.AuctionCandidate{AdId: id, Basis: services.BasisCpm, BidMinor: bidMinor, PctrPpm: pctr, BaselinePpm: 20_000, ReserveMicros: 50_000 * 1_000_000}
}

func cpcCandidate(id string, bidMinor, pctr int64) services.AuctionCandidate {
	return services.AuctionCandidate{AdId: id, Basis: services.BasisCpc, BidMinor: bidMinor, PctrPpm: pctr, BaselinePpm: 20_000, ReserveMicros: 50_000 * 1_000_000}
}

func TestAuctionPicksHighestScoreAndChargesSecondPriceNotBid(t *testing.T) {
	outcome, ok := services.RunSecondPriceAuction([]services.AuctionCandidate{cpmCandidate("a", 400_000, 20_000), cpmCandidate("b", 300_000, 20_000), cpmCandidate("c", 100_000, 20_000)})
	if !ok || outcome.WinnerAdId != "a" {
		t.Fatalf("expected a to win, got %+v", outcome)
	}
	perImpressionBidMicros := int64(400_000 * 1_000)
	if outcome.ClearingMicros >= perImpressionBidMicros {
		t.Fatalf("second price must be below the bid: %d vs %d", outcome.ClearingMicros, perImpressionBidMicros)
	}
	if outcome.ClearingMicros < 300_000*1_000 || outcome.ClearingMicros > 300_000*1_000+1_000 {
		t.Fatalf("clearing should be just above the runner-up bid, got %d", outcome.ClearingMicros)
	}
}

func TestAuctionNeverChargesAboveBidEvenWhenRunnerUpTies(t *testing.T) {
	outcome, ok := services.RunSecondPriceAuction([]services.AuctionCandidate{cpmCandidate("a", 400_000, 20_000), cpmCandidate("b", 400_000, 20_000)})
	if !ok || outcome.WinnerAdId != "a" {
		t.Fatalf("deterministic tie-break by ad id expected, got %+v", outcome)
	}
	if outcome.ClearingMicros > 400_000*1_000 {
		t.Fatalf("charge %d exceeds bid", outcome.ClearingMicros)
	}
}

func TestAuctionSingleBidderPaysReserveNotBid(t *testing.T) {
	outcome, ok := services.RunSecondPriceAuction([]services.AuctionCandidate{cpmCandidate("solo", 900_000, 20_000)})
	if !ok {
		t.Fatal("expected a winner")
	}
	if outcome.ClearingEcpmMicro != 50_000*1_000_000 {
		t.Fatalf("single bidder should pay the reserve, got %d", outcome.ClearingEcpmMicro)
	}
}

func TestAuctionRanksCpcBidsByBidTimesPredictedCtr(t *testing.T) {
	outcome, ok := services.RunSecondPriceAuction([]services.AuctionCandidate{cpcCandidate("highBidLowCtr", 10_000, 5_000), cpcCandidate("lowBidHighCtr", 6_000, 40_000)})
	if !ok || outcome.WinnerAdId != "lowBidHighCtr" {
		t.Fatalf("expected ctr-weighted winner, got %+v", outcome)
	}
	if outcome.Basis != services.BasisCpc || outcome.ClearingMicros > 6_000*1_000_000 {
		t.Fatalf("per-click price must not exceed max cpc, got %+v", outcome)
	}
}

func TestAuctionQualityLetsBetterCreativeBeatSlightlyHigherCpmBid(t *testing.T) {
	outcome, _ := services.RunSecondPriceAuction([]services.AuctionCandidate{cpmCandidate("plain", 105_000, 20_000), cpmCandidate("engaging", 100_000, 40_000)})
	if outcome.WinnerAdId != "engaging" {
		t.Fatalf("expected the higher quality creative to win, got %s", outcome.WinnerAdId)
	}
}

func TestAuctionDropsBidsBelowReserveAndInvalidInputs(t *testing.T) {
	candidates := []services.AuctionCandidate{cpmCandidate("cheap", 10, 20_000), cpmCandidate("zeroCtr", 400_000, 0), cpmCandidate("zeroBid", 0, 20_000)}
	if _, ok := services.RunSecondPriceAuction(candidates); ok {
		t.Fatal("no candidate should clear the reserve")
	}
}
