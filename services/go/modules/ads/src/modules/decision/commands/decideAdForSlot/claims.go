package decideadforslot

import (
	"context"

	"zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

func (handler Handler) buildClaims(ctx context.Context, slot *slotContext, winner types.CandidateAd, outcome services.AuctionOutcome, pctrPpm int64, impressionId string, newReach bool) services.AdTokenClaims {
	rule := services.QualificationRuleForSlot(slot.command.Slot.Kind, winner.VideoDurationSeconds)
	claims := services.AdTokenClaims{
		ImpressionId: impressionId, AdId: winner.AdId, AdGroupId: winner.AdGroupId, CampaignId: winner.CampaignId, AccountId: winner.AccountId,
		UserId: slot.command.UserId, SessionId: slot.command.SessionId, Placement: slot.placement, SlotKind: slot.command.Slot.Kind,
		ContentId: slot.command.Slot.ContentId, Country: slot.command.Viewer.Country, Region: slot.command.Viewer.Region,
		Currency: winner.Currency, Timezone: winner.Timezone, Basis: outcome.Basis, PriceMicros: outcome.ClearingMicros, PctrPpm: pctrPpm,
		QualifyWatchMs: rule.WatchMs, QualifyVisiblePct: rule.VisiblePercent, NewReachToday: newReach, MultiplierBps: services.DefaultOriginalMultiplier,
	}
	if slot.command.Viewer.PersonalizedAds {
		claims.AgeBand, claims.Gender = slot.command.Viewer.AgeBand, slot.command.Viewer.Gender
	}
	if slot.signal != nil && services.IsContentAdjacentSlot(slot.command.Slot.Kind) {
		claims.CreatorUserId, claims.AiGenerated = slot.signal.CreatorUserId, slot.signal.AiGenerated
		rows, err := handler.Container.Policies.MonetizationRows(ctx)
		if err != nil {
			rows = nil
		}
		claims.CreatorShareBps, claims.MultiplierBps = services.ResolveCreatorShareWithDefault(rows, slot.signal.AiGenerated, slot.now, handler.Container.Policies.CreatorShareBps(ctx))
	}
	return claims
}
