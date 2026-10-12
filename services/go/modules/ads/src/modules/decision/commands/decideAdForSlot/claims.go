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
	if handler.sharesRevenueWithCreator(ctx, slot) {
		claims.CreatorUserId, claims.AiGenerated = slot.signal.CreatorUserId, slot.signal.AiGenerated
		rows, err := handler.Container.Policies.MonetizationRows(ctx)
		if err != nil {
			rows = nil
		}
		claims.CreatorShareBps, claims.MultiplierBps = services.ResolveCreatorShareWithDefault(rows, slot.signal.AiGenerated, slot.now, handler.Container.Policies.CreatorShareBps(ctx))
	}
	return claims
}

func (handler Handler) sharesRevenueWithCreator(ctx context.Context, slot *slotContext) bool {
	if slot.signal == nil || slot.signal.CreatorUserId == "" || slot.signal.CreatorUserId == slot.command.UserId {
		return false
	}
	if services.IsContentAdjacentSlot(slot.command.Slot.Kind) {
		return true
	}
	if slot.command.Slot.Kind != services.SlotFeedCommentThread {
		return false
	}
	members := services.CreatorProgramMembers{Client: handler.Container.Client, Now: handler.Container.Now}
	paid, err := members.IsCreatorPaidForCommentThreadAds(ctx, slot.signal.CreatorUserId, slot.signal.MonetizationEligible)
	if err != nil {
		handler.Container.Logger.WarnContext(ctx, "creator program lookup failed; comment ad revenue stays with the platform", "error", err)
		return false
	}
	return paid
}
