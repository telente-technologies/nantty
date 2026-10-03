package validators

import (
	"slices"
	"strings"

	"zudomart/modules/live/src/modules/sessions/dtos"
	"zudomart/modules/live/src/utils"
	"zudomart/platform/httpserver"
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
