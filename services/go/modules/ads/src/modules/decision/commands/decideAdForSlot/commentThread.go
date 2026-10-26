package decideadforslot

import (
	"context"
	"fmt"
	"time"

	"nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
)

const (
	threadRepliesBeforeFirstAd = 3
	threadRepliesBetweenAds    = 8
	threadSlotMemory           = 12 * time.Hour
)

func (handler Handler) checkCommentThreadSpacing(ctx context.Context, slot *slotContext) (string, error) {
	request := slot.command.Slot
	if request.Kind != services.SlotFeedCommentThread || request.SlotIndex == nil {
		return "", nil
	}
	if *request.SlotIndex < threadRepliesBeforeFirstAd {
		return "frequencyCap", nil
	}
	if request.SlotsSinceLastAd != nil && *request.SlotsSinceLastAd < threadRepliesBetweenAds {
		return "frequencyCap", nil
	}
	key := fmt.Sprintf("thread:%s:%s:%s:%d", slot.command.UserId, slot.command.SessionId, request.ContentId, *request.SlotIndex)
	decisions, err := handler.Container.Counters.Increment(ctx, key, 1, threadSlotMemory)
	if err != nil {
		return "", err
	}
	if decisions > 1 {
		return "frequencyCap", nil
	}
	return "", nil
}

func noEligibleAdReason(slot *slotContext) string {
	if slot.command.Slot.Kind == services.SlotFeedCommentThread && !slot.command.Viewer.PersonalizedAds {
		return "contextualOnly"
	}
	return "no_eligible_ad"
}

func labelForSlot(slot *slotContext, winner types.CandidateAd) string {
	if winner.CampaignKind == "boost" {
		return "Boosted"
	}
	if slot.command.Slot.Kind == services.SlotFeedCommentThread {
		return "Promoted"
	}
	return "Ad"
}
