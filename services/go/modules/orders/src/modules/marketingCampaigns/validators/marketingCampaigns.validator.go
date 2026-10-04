package validators

import (
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/modules/marketingCampaigns/dtos"
	"zudomart/modules/orders/src/utils"
)

const maximumFlashSaleLength = 7 * 24 * time.Hour

func ValidateFlashSaleStateChange(body dtos.FlashSaleRequest) error {
	var collected utils.Issues
	if body.Action == nil || !slices.Contains([]string{"pause", "resume", "end"}, *body.Action) {
		collected.Add("action", "must be pause, resume or end")
	}
	return collected.AsError()
}

func ValidateFlashSale(body dtos.FlashSaleRequest) error {
	if body.Action != nil {
		if body.Name != nil || body.StartsAt != nil || body.EndsAt != nil || body.Items != nil {
			return utils.Issues{{Path: "action", Message: "cannot be combined with other fields"}}.AsError()
		}
		return ValidateFlashSaleStateChange(body)
	}
	var collected utils.Issues
	if body.Name == nil || body.StartsAt == nil || body.EndsAt == nil {
		collected.Add("name", "name, startsAt and endsAt are required")
		return collected.AsError()
	}
	collected.CheckLength("name", *body.Name, 3, 80)
	if !body.EndsAt.After(*body.StartsAt) || body.EndsAt.Sub(*body.StartsAt) > maximumFlashSaleLength {
		collected.Add("endsAt", "must be after startsAt and at most 7 days later")
	}
	if len(body.Items) < 1 || len(body.Items) > 20 {
		collected.Add("items", "must contain 1 to 20 products")
	}
	seen := map[uuid.UUID]bool{}
	for index, item := range body.Items {
		path := "items." + strconv.Itoa(index)
		identifier := utils.ParseIdentifier(path+".productId", item.ProductId, &collected)
		if seen[identifier] {
			collected.Add(path+".productId", "must be unique")
		}
		seen[identifier] = true
		if item.SalePriceMinor <= 0 {
			collected.Add(path+".salePriceMinor", "must be above zero")
		}
		if item.StockCap != nil {
			collected.CheckRange(path+".stockCap", *item.StockCap, 1, 100_000)
		}
	}
	return collected.AsError()
}

func ValidateProductBundle(body dtos.ProductBundleRequest) error {
	var collected utils.Issues
	collected.CheckLength("name", body.Name, 3, 80)
	if len(body.Description) > 300 {
		collected.Add("description", "must be at most 300 characters")
	}
	if body.BundlePriceMinor <= 0 {
		collected.Add("bundlePriceMinor", "must be above zero")
	}
	if !slices.Contains([]string{"active", "paused", "draft"}, body.Status) {
		collected.Add("status", "must be active, paused or draft")
	}
	if len(body.Items) < 1 || len(body.Items) > 10 {
		collected.Add("items", "must contain 1 to 10 products")
	}
	seen, units := map[uuid.UUID]bool{}, 0
	for index, item := range body.Items {
		path := "items." + strconv.Itoa(index)
		identifier := utils.ParseIdentifier(path+".productId", item.ProductId, &collected)
		if seen[identifier] {
			collected.Add(path+".productId", "must be unique")
		}
		seen[identifier] = true
		collected.CheckRange(path+".quantity", item.Quantity, 1, 20)
		units += item.Quantity
	}
	if units < 2 {
		collected.Add("items", "must add up to at least 2 units")
	}
	return collected.AsError()
}
