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
	if viewer.AgeBand == "13-17" {
		return "minor", nil
	}
	if slot.command.UserId == "" {
		return "no_viewer", nil
	}
	enabled, err := handler.Container.Consent.PersonalizedAdsEnabled(ctx, slot.command.UserId)
	viewer.PersonalizedAds = enabled
	return "", err
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
