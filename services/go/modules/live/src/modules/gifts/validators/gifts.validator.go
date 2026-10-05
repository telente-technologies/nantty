package validators

import (
	"slices"
	"strings"

	"zudomart/modules/live/src/modules/gifts/dtos"
	"zudomart/modules/live/src/utils"
)

func ValidateSendGiftRequest(body dtos.SendGiftRequest) error {
	var collected utils.Issues
	utils.ParseIdentifiers("liveId", []string{body.LiveId}, &collected)
	collected = append(collected, validateGiftFields(body.GiftId, body.Quantity, body.ReceiverUserId, body.ComboId)...)
	return collected.AsError()
}

func ValidatePathSendGiftRequest(body dtos.PathSendGiftRequest) error {
	return utils.Issues(validateGiftFields(body.GiftId, body.Quantity, body.ReceiverUserId, body.ComboId)).AsError()
}

func validateGiftFields(giftId string, quantity int, receiverUserId, comboId string) utils.Issues {
	var collected utils.Issues
	if giftId == "" || len(giftId) > 64 {
		collected.Add("giftId", "is required")
	}
	if quantity < 1 || quantity > 100 {
		collected.Add("quantity", "must be between 1 and 100")
	}
	if receiverUserId != "" {
		utils.ParseIdentifiers("receiverUserId", []string{receiverUserId}, &collected)
	}
	if len(comboId) > 64 {
		collected.Add("comboId", "must be at most 64 characters")
	}
	return collected
}

func ValidateGiftGoalRequest(body dtos.GiftGoalRequest, creating bool) error {
	var collected utils.Issues
	if creating && (body.Title == nil || body.TargetCoins == nil) {
		collected.Add("title", "title and targetCoins are required")
	}
	if body.Title != nil && (strings.TrimSpace(*body.Title) == "" || len(*body.Title) > 80) {
		collected.Add("title", "must be 1-80 characters")
	}
	if body.TargetCoins != nil && *body.TargetCoins < 10 {
		collected.Add("targetCoins", "must be at least 10")
	}
	if giftId := body.GiftId.Value; giftId != nil && (strings.TrimSpace(*giftId) == "" || len(*giftId) > 64) {
		collected.Add("giftId", "must be a gift id or null")
	}
	return collected.AsError()
}

func ValidateGiftRequest(body dtos.GiftRequest, creating bool) error {
	var collected utils.Issues
	if creating {
		if body.Id == "" || body.Name == nil || body.Tier == nil || body.PriceCoins == nil || body.AnimationAssetKey == nil || body.PreviewAssetKey == nil || body.DurationMs == nil || body.DisplayLevel == nil {
			collected.Add("id", "id, name, tier, priceCoins, animationAssetKey, previewAssetKey, durationMs and displayLevel are required")
		}
	}
	checkEnum := func(path string, value *string, allowed []string) {
		if value != nil && !slices.Contains(allowed, *value) {
			collected.Add(path, "must be one of "+strings.Join(allowed, ", "))
		}
	}
	checkEnum("tier", body.Tier, utils.GiftTiers)
	checkEnum("animationEngine", body.AnimationEngine, utils.AnimationEngines)
	checkEnum("displayLevel", body.DisplayLevel, utils.DisplayLevels)
	checkEnum("haptic", body.Haptic, utils.Haptics)
	if body.PriceCoins != nil && *body.PriceCoins < 1 {
		collected.Add("priceCoins", "must be positive")
	}
	if body.DurationMs != nil && *body.DurationMs < 1 {
		collected.Add("durationMs", "must be positive")
	}
	return collected.AsError()
}
