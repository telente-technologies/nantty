package validators

import (
	"encoding/json"
	"slices"
	"strings"
	"time"

	"nantty/modules/live/src/modules/sessions/dtos"
	"nantty/modules/live/src/utils"
	"nantty/platform/httpserver"
)

func ValidateCreateLiveRequest(body dtos.CreateLiveRequest) error {
	var collected utils.Issues
	if title := strings.TrimSpace(body.Title); title == "" || len(title) > 140 {
		collected.Add("title", "must be 1-140 characters")
	}
	if !slices.Contains(utils.LiveCategories, body.Category) {
		collected.Add("category", "must be one of "+strings.Join(utils.LiveCategories, ", "))
	}
	if body.Visibility != "" && body.Visibility != "public" && body.Visibility != "followers" && body.Visibility != "subscribers" {
		collected.Add("visibility", "must be public, followers or subscribers")
	}
	if body.StoreId != "" {
		utils.ParseIdentifiers("storeId", []string{body.StoreId}, &collected)
	}
	utils.ParseIdentifiers("productIds", body.ProductIds, &collected)
	if body.SponsorshipLine != nil && len(*body.SponsorshipLine) > 200 {
		collected.Add("sponsorshipLine", "must be at most 200 characters")
	}
	if body.ScheduledAt != nil {
		if _, err := time.Parse(time.RFC3339, *body.ScheduledAt); err != nil {
			collected.Add("scheduledAt", "must be an RFC 3339 time")
		}
	}
	return collected.AsError()
}

func ReadScheduledAt(raw json.RawMessage) (*time.Time, bool, error) {
	if len(raw) == 0 {
		return nil, false, nil
	}
	if string(raw) == "null" {
		return nil, true, nil
	}
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		if parsed, err := time.Parse(time.RFC3339, text); err == nil {
			return &parsed, true, nil
		}
	}
	var collected utils.Issues
	collected.Add("scheduledAt", "must be an RFC 3339 time or null")
	return nil, false, collected.AsError()
}

func ValidateUpdateLiveRequest(body dtos.UpdateLiveRequest) error {
	var collected utils.Issues
	if body.Title == nil && body.Category == nil && len(body.ScheduledAt) == 0 {
		collected.Add("title", "send title, category or scheduledAt")
	}
	if body.Title != nil {
		if title := strings.TrimSpace(*body.Title); title == "" || len(title) > 140 {
			collected.Add("title", "must be 1-140 characters")
		}
	}
	if body.Category != nil && !slices.Contains(utils.LiveCategories, *body.Category) {
		collected.Add("category", "must be one of "+strings.Join(utils.LiveCategories, ", "))
	}
	if _, _, err := ReadScheduledAt(body.ScheduledAt); err != nil {
		collected.Add("scheduledAt", "must be an RFC 3339 time or null")
	}
	return collected.AsError()
}

func ValidateMonetizationRequest(body dtos.MonetizationRequest) error {
	if body.LiveAdSettings == nil && body.SponsorshipLine == nil {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "liveAdSettings", Message: "send liveAdSettings or sponsorshipLine"}})
	}
	return nil
}

func ValidatePinProductRequest(body dtos.PinProductRequest) error {
	var collected utils.Issues
	utils.ParseIdentifiers("productId", []string{body.ProductId}, &collected)
	return collected.AsError()
}
