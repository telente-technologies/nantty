package decideadforslot

import (
	"context"
	"slices"

	"zudomart/modules/ads/src/services"
)

func (handler Handler) checkViewerEligibility(ctx context.Context, slot *slotContext) (string, error) {
	viewer := &slot.command.Viewer
	if viewer.PremiumAdFree {
		return "premium_ad_free", nil
	}
	if slot.command.UserId == "" {
		return "no_viewer", nil
	}
	if reason := handler.checkPlanAdLoad(ctx, slot); reason != "" {
		return reason, nil
	}
	if !handler.viewerIsKnownAdult(ctx, slot) {
		viewer.AgeRestricted, viewer.PersonalizedAds, viewer.AgeBand, viewer.Gender = true, false, "", ""
		return "", nil
	}
	enabled, err := handler.Container.Consent.PersonalizedAdsEnabled(ctx, slot.command.UserId)
	viewer.PersonalizedAds = enabled
	return "", err
}

func (handler Handler) viewerIsKnownAdult(ctx context.Context, slot *slotContext) bool {
	if slot.command.Viewer.AgeBand == "13-17" || handler.Container.ViewerAge == nil {
		return false
	}
	adult, err := handler.Container.ViewerAge.IsAdultViewer(ctx, slot.command.UserId)
	if err != nil {
		handler.Container.Logger.WarnContext(ctx, "viewer age unavailable; serving contextual age-safe ads only", "error", err)
		return false
	}
	return adult
}

func (handler Handler) checkPlanAdLoad(ctx context.Context, slot *slotContext) string {
	percent := services.FullAdLoadPercent
	if handler.Container.AdLoad != nil {
		read, err := handler.Container.AdLoad.AdLoadPercent(ctx, slot.command.UserId)
		if err != nil {
			handler.Container.Logger.WarnContext(ctx, "plan ad load unavailable; using the full load", "error", err)
		} else {
			percent = read
		}
	}
	request := slot.command.Slot
	return services.AdLoadDeclineReason(percent, services.AdLoadRoll(services.AdLoadSlotKey{
		UserId: slot.command.UserId, SessionId: slot.command.SessionId, SlotKind: request.Kind, ContentId: request.ContentId,
		SlotIndex: request.SlotIndex, SlotsSinceLastAd: request.SlotsSinceLastAd, Neighbours: request.NeighbourContentIds, At: slot.now,
	}))
}

func (handler Handler) checkContentEligibility(ctx context.Context, slot *slotContext) (string, error) {
	slotData := slot.command.Slot
	signal := slot.command.TrustedSignal
	if signal == nil && slotData.ContentId != "" {
		found, ok, err := handler.Container.Signals.FindContentSignal(ctx, slotData.ContentId)
		if err != nil {
			return "", err
		}
		if ok {
			signal = &found
		}
	}
	slot.signal = signal
	if slotData.Kind == services.SlotFeedCommentThread && signal != nil {
		switch {
		case signal.Removed:
			return "content_removed", nil
		case !signal.BrandSafe || signal.Sensitive || signal.KidsContent:
			return "content_not_brand_safe", nil
		}
	}
	if services.IsContentAdjacentSlot(slotData.Kind) {
		if signal == nil {
			return "content_signals_missing", nil
		}
		switch {
		case !signal.BrandSafe || signal.Sensitive || signal.KidsContent:
			return "content_not_brand_safe", nil
		case !signal.MonetizationEligible:
			return "creator_not_monetization_eligible", nil
		case !slices.Contains(signal.OptedInPlacements, slotData.Kind):
			return "creator_not_opted_in", nil
		case signal.DurationSeconds < handler.Container.Settings.MinimumPrerollSeconds:
			return "content_too_short", nil
		}
	}
	return handler.checkNeighbours(ctx, slot)
}

func (handler Handler) checkNeighbours(ctx context.Context, slot *slotContext) (string, error) {
	for _, neighbourId := range slot.command.Slot.NeighbourContentIds {
		neighbour, found, err := handler.Container.Signals.FindContentSignal(ctx, neighbourId)
		if err != nil {
			return "", err
		}
		if found && (neighbour.Sensitive || neighbour.KidsContent || !neighbour.BrandSafe) {
			return "unsafe_neighbour", nil
		}
	}
	return "", nil
}

func (handler Handler) checkUserExperienceGuard(ctx context.Context, slot *slotContext) (string, error) {
	policies, err := handler.Container.Policies.FrequencyPolicies(ctx)
	if err != nil {
		return "", err
	}
	slot.formatCap, slot.totalCap = policies[slot.placement], policies[services.FrequencyPolicyAllFormats]
	if verdict := handler.Container.Frequency.CheckUserExperienceGap(slot.command.Slot.SlotsSinceLastAd, slot.formatCap); !verdict.Allowed {
		return verdict.Reason, nil
	}
	cooling, err := handler.Container.Frequency.IsCoolingDownAfterSkip(ctx, slot.command.UserId)
	if cooling {
		return "cooldown_after_skip", err
	}
	return "", err
}
