package decideadforslot

import (
	"context"

	"zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

func (handler Handler) scoreAndAuction(ctx context.Context, slot *slotContext, eligible []types.CandidateAd) (services.AuctionOutcome, types.CandidateAd, int64, bool, error) {
	request := types.PctrRequest{Viewer: slot.command.Viewer, SlotKind: slot.command.Slot.Kind, Placement: slot.placement}
	for _, candidate := range eligible {
		request.Candidates = append(request.Candidates, handler.pctrCandidate(candidate))
	}
	scores, err := handler.Container.Pctr.ScorePredictedClickRatesInPpm(ctx, request)
	if err != nil {
		return services.AuctionOutcome{}, types.CandidateAd{}, 0, false, err
	}
	auctionCandidates := make([]services.AuctionCandidate, 0, len(eligible))
	byAdId := make(map[string]types.CandidateAd, len(eligible))
	for _, candidate := range eligible {
		auctionCandidate, usable := handler.toAuctionCandidate(candidate, scores[candidate.AdId])
		if usable {
			auctionCandidates = append(auctionCandidates, auctionCandidate)
			byAdId[candidate.AdId] = candidate
		}
	}
	outcome, ok := services.RunSecondPriceAuction(auctionCandidates)
	if !ok {
		return outcome, types.CandidateAd{}, 0, false, nil
	}
	return outcome, byAdId[outcome.WinnerAdId], scores[outcome.WinnerAdId], true, nil
}

func (handler Handler) toAuctionCandidate(candidate types.CandidateAd, pctrPpm int64) (services.AuctionCandidate, bool) {
	reserveMinor, known := handler.Container.Settings.ReservePerMilleMinor[candidate.Currency]
	if !known || pctrPpm <= 0 {
		return services.AuctionCandidate{}, false
	}
	auction := services.AuctionCandidate{AdId: candidate.AdId, PctrPpm: pctrPpm, BaselinePpm: handler.Container.Settings.BaselineCtrPpm, ReserveMicros: reserveMinor * types.MicrosPerMinorUnit}
	switch candidate.BidType {
	case "max_cpc", "target_cost":
		auction.Basis, auction.BidMinor = services.BasisCpc, candidate.BidMinor
	case "max_cpm":
		auction.Basis, auction.BidMinor = services.BasisCpm, candidate.BidMinor
	default:
		auction.Basis, auction.BidMinor = services.BasisCpm, reserveMinor*handler.Container.Settings.AutoBidMultiple
	}
	return auction, true
}

func (handler Handler) pctrCandidate(candidate types.CandidateAd) types.PctrCandidate {
	budgetMicros := candidate.GroupBudgetMicros
	if budgetMicros == 0 {
		budgetMicros = candidate.CampaignBudgetMicros
	}
	return types.PctrCandidate{
		AdId: candidate.AdId, CampaignId: candidate.CampaignId, AccountId: candidate.AccountId, Format: candidate.Creative.Format, BidType: candidate.BidType, BidMinor: candidate.BidMinor,
		DailyBudgetMinor: budgetMicros / types.MicrosPerMinorUnit, Currency: candidate.Currency, Placements: candidate.Placements,
		HistoricalImpressions: candidate.HistoricalImpressions, HistoricalClicks: candidate.HistoricalClicks,
	}
}
