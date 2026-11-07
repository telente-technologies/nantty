package services

import (
	"slices"

	"nantty/modules/ads/src/types"
)

var AllAdvertiserPlacements = []string{"feed", "clips", "mart", "search", "stories", "live"}

const (
	SlotFeedPost    = "feedPost"
	SlotPreRoll     = "preRoll"
	SlotPostRoll    = "postRoll"
	SlotClipBetween = "clipBetween"
	SlotMartTile    = "martTile"
	SlotSearchTile  = "searchTile"
	SlotFeedProduct = "feedProduct"
	SlotStory       = "story"
	SlotLiveBreak   = "liveBreak"

	SlotFeedCommentThread = "feedCommentThread"
)

var placementBySlotKind = map[string]string{
	SlotFeedPost: "feed", SlotPreRoll: "feed", SlotPostRoll: "feed", SlotClipBetween: "clips",
	SlotMartTile: "mart", SlotSearchTile: "search", SlotFeedProduct: "feed", SlotStory: "stories", SlotLiveBreak: "live", SlotFeedCommentThread: "feed",
}

var creativeFormatsBySlotKind = map[string][]string{
	SlotFeedPost: {"feed_post", "live", "product", "store"}, SlotPreRoll: {"feed_post", "clip"}, SlotPostRoll: {"feed_post", "clip"},
	SlotClipBetween: {"clip", "live"}, SlotMartTile: {"product"}, SlotSearchTile: {"product"}, SlotFeedProduct: {"product"}, SlotStory: {"story", "clip"}, SlotLiveBreak: {"live"},
	SlotFeedCommentThread: {"feed_post", "product", "store"},
}

var entitySlotKinds = []string{SlotFeedPost, SlotFeedCommentThread}

func PlacementForSlotKind(slotKind string) (string, bool) {
	placement, found := placementBySlotKind[slotKind]
	return placement, found
}

func CreativeFitsSlotKind(creativeFormat, slotKind string) bool {
	return slices.Contains(creativeFormatsBySlotKind[slotKind], creativeFormat)
}

func CreativeFitsSlot(creative types.Creative, slotKind string) bool {
	if !CreativeFitsSlotKind(creative.Format, slotKind) {
		return false
	}
	if isPromotableEntityKind(creative.Source.Type) {
		return slices.Contains(entitySlotKinds, slotKind)
	}
	return true
}

func IsContentAdjacentSlot(slotKind string) bool {
	return slotKind == SlotPreRoll || slotKind == SlotPostRoll
}

func NormalizePlacementAlias(placement string) string {
	if placement == "live_discovery" {
		return "live"
	}
	return placement
}

type QualificationRule struct {
	WatchMs        int
	VisiblePercent int
}

func QualificationRuleForSlot(slotKind string, videoDurationSeconds int) QualificationRule {
	switch slotKind {
	case SlotPreRoll, SlotPostRoll:
		half := videoDurationSeconds * 1000 / 2
		return QualificationRule{WatchMs: min(30_000, max(5_000, half)), VisiblePercent: 50}
	case SlotClipBetween, SlotLiveBreak:
		return QualificationRule{WatchMs: 2_000, VisiblePercent: 50}
	default:
		return QualificationRule{WatchMs: 1_000, VisiblePercent: 50}
	}
}
