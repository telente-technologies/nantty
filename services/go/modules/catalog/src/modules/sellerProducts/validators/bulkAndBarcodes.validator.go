package validators

import (
	"slices"

	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/modules/sellerProducts/dtos"
	"nantty/modules/catalog/src/utils"
)

var bulkActions = []string{"publish", "unpublish", "archive", "set_category", "set_visibility", "change_price_percent"}

func ValidateBulkAction(body dtos.BulkActionRequest) error {
	var collected utils.Issues
	if !slices.Contains(bulkActions, body.Action) {
		collected.Add("action", "must be one of the supported bulk actions")
	}
	if len(body.ProductIds) < 1 || len(body.ProductIds) > 200 {
		collected.Add("productIds", "must contain 1 to 200 ids")
	}
	utils.ParseIdentifiers("productIds", body.ProductIds, &collected)
	if body.CategoryId != nil {
		utils.ParseIdentifier("categoryId", *body.CategoryId, &collected)
	}
	if body.Action == "set_visibility" && (body.Visibility == nil || !slices.Contains(enums.ProductVisibilities, *body.Visibility)) {
		collected.Add("visibility", "must be public, store_only or link_only")
	}
	if body.Action == "change_price_percent" && (body.PricePercentBasisPoints == nil || *body.PricePercentBasisPoints == 0 || *body.PricePercentBasisPoints < -9000 || *body.PricePercentBasisPoints > 50000) {
		collected.Add("pricePercentBasisPoints", "must be between -9000 and 50000 and not zero")
	}
	return collected.AsError()
}

func ValidateBarcodeRequest(body dtos.BarcodeRequest) error {
	var collected utils.Issues
	collected.CheckRange("count", body.Count, 1, 100)
	return collected.AsError()
}
