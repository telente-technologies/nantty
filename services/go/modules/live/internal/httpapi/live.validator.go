package httpapi

import (
	"slices"
	"strings"

	"github.com/google/uuid"

	"zudomart/platform/httpserver"
)

type issues []httpserver.ValidationIssue

func (collected *issues) add(path, message string) {
	*collected = append(*collected, httpserver.ValidationIssue{Path: path, Message: message})
}

func (collected issues) asError() error {
	if len(collected) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collected)
}

var (
	liveCategories   = []string{"justChatting", "gaming", "music", "irl", "education", "shopping"}
	giftTiers        = []string{"basic", "premium", "legendary"}
	animationEngines = []string{"alphaVideo", "lottie", "pag", "spriteSheet"}
	displayLevels    = []string{"micro", "medium", "large", "global"}
	haptics          = []string{"light", "medium", "heavy", "pattern"}
	rankingBoards    = []string{"streamer", "supporter", "creator", "engagement"}
	rankingScopes    = []string{"global", "country", "category"}
	rankingPeriods   = []string{"day", "week", "month", "all"}
)

func parseIdentifiers(path string, values []string, collected *issues) []uuid.UUID {
	parsed := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		identifier, err := uuid.Parse(value)
		if err != nil {
			collected.add(path, "must contain valid ids")
			continue
		}
		parsed = append(parsed, identifier)
	}
	return parsed
}

func ValidateCreateLiveRequest(body createLiveRequest) error {
	var collected issues
	if title := strings.TrimSpace(body.Title); title == "" || len(title) > 140 {
		collected.add("title", "must be 1-140 characters")
	}
	if !slices.Contains(liveCategories, body.Category) {
		collected.add("category", "must be one of "+strings.Join(liveCategories, ", "))
	}
	if body.Visibility != "" && body.Visibility != "public" && body.Visibility != "followers" {
		collected.add("visibility", "must be public or followers")
	}
	if body.StoreId != "" {
		parseIdentifiers("storeId", []string{body.StoreId}, &collected)
	}
	parseIdentifiers("productIds", body.ProductIds, &collected)
	if body.SponsorshipLine != nil && len(*body.SponsorshipLine) > 200 {
		collected.add("sponsorshipLine", "must be at most 200 characters")
	}
	return collected.asError()
}

func ValidateMonetizationRequest(body monetizationRequest) error {
	if body.LiveAdSettings == nil && body.SponsorshipLine == nil {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "liveAdSettings", Message: "send liveAdSettings or sponsorshipLine"}})
	}
	return nil
}

func ValidatePinProductRequest(body pinProductRequest) error {
	var collected issues
	parseIdentifiers("productId", []string{body.ProductId}, &collected)
	return collected.asError()
}

func ValidateInviteGuestRequest(body inviteGuestRequest) error {
	var collected issues
	parseIdentifiers("userId", []string{body.UserId}, &collected)
	return collected.asError()
}

func ValidateMuteRequest(body muteRequest) error {
	if body.Audio == nil && body.Video == nil {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "audio", Message: "send audio and/or video"}})
	}
	return nil
}

func ValidateConnectionRequest(body connectionRequest) error {
	if body.Connected == nil {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "connected", Message: "is required"}})
	}
	return nil
}

func ValidateCreateBattleRequest(body createBattleRequest) error {
	var collected issues
	parsed := parseIdentifiers("participantUserIds", body.ParticipantUserIds, &collected)
	unique := map[uuid.UUID]bool{}
	for _, identifier := range parsed {
		unique[identifier] = true
	}
	if len(unique) != len(parsed) || len(parsed) < 2 || len(parsed) > 10 {
		collected.add("participantUserIds", "needs 2 to 10 different streamers")
	}
	if body.DurationSeconds < 60 || body.DurationSeconds > 600 {
		collected.add("durationSeconds", "must be between 60 and 600")
	}
	return collected.asError()
}

func ValidateSendGiftRequest(body sendGiftRequest) error {
	var collected issues
	parseIdentifiers("liveId", []string{body.LiveId}, &collected)
	collected = append(collected, validateGiftFields(body.GiftId, body.Quantity, body.ReceiverUserId, body.ComboId)...)
	return collected.asError()
}

func ValidatePathSendGiftRequest(body pathSendGiftRequest) error {
	return issues(validateGiftFields(body.GiftId, body.Quantity, body.ReceiverUserId, body.ComboId)).asError()
}

func validateGiftFields(giftId string, quantity int, receiverUserId, comboId string) issues {
	var collected issues
	if giftId == "" || len(giftId) > 64 {
		collected.add("giftId", "is required")
	}
	if quantity < 1 || quantity > 100 {
		collected.add("quantity", "must be between 1 and 100")
	}
	if receiverUserId != "" {
		parseIdentifiers("receiverUserId", []string{receiverUserId}, &collected)
	}
	if len(comboId) > 64 {
		collected.add("comboId", "must be at most 64 characters")
	}
	return collected
}

func ValidateGiftGoalRequest(body giftGoalRequest, creating bool) error {
	var collected issues
	if creating && (body.Title == nil || body.TargetCoins == nil) {
		collected.add("title", "title and targetCoins are required")
	}
	if body.Title != nil && (strings.TrimSpace(*body.Title) == "" || len(*body.Title) > 80) {
		collected.add("title", "must be 1-80 characters")
	}
	if body.TargetCoins != nil && *body.TargetCoins < 10 {
		collected.add("targetCoins", "must be at least 10")
	}
	return collected.asError()
}

func ValidateEngagementRequest(body engagementRequest) error {
	if !slices.Contains([]string{"like", "share", "follow", "watch"}, body.Action) {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "action", Message: "must be like, share, follow or watch"}})
	}
	return nil
}

func ValidateGiftRequest(body giftRequest, creating bool) error {
	var collected issues
	if creating {
		if body.Id == "" || body.Name == nil || body.Tier == nil || body.PriceCoins == nil || body.AnimationAssetKey == nil || body.PreviewAssetKey == nil || body.DurationMs == nil || body.DisplayLevel == nil {
			collected.add("id", "id, name, tier, priceCoins, animationAssetKey, previewAssetKey, durationMs and displayLevel are required")
		}
	}
	checkEnum := func(path string, value *string, allowed []string) {
		if value != nil && !slices.Contains(allowed, *value) {
			collected.add(path, "must be one of "+strings.Join(allowed, ", "))
		}
	}
	checkEnum("tier", body.Tier, giftTiers)
	checkEnum("animationEngine", body.AnimationEngine, animationEngines)
	checkEnum("displayLevel", body.DisplayLevel, displayLevels)
	checkEnum("haptic", body.Haptic, haptics)
	if body.PriceCoins != nil && *body.PriceCoins < 1 {
		collected.add("priceCoins", "must be positive")
	}
	if body.DurationMs != nil && *body.DurationMs < 1 {
		collected.add("durationMs", "must be positive")
	}
	return collected.asError()
}
