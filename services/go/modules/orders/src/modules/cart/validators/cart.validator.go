package validators

import (
	"slices"

	"zudomart/modules/orders/src/modules/cart/dtos"
	"zudomart/modules/orders/src/types"
	"zudomart/modules/orders/src/utils"
)

func ValidateAddCartItem(body dtos.AddCartItemRequest) error {
	var collected utils.Issues
	utils.ParseIdentifier("productId", body.ProductId, &collected)
	if body.VariantId != nil {
		utils.ParseIdentifier("variantId", *body.VariantId, &collected)
	}
	collected.CheckRange("quantity", body.Quantity, 1, 99)
	if body.Attribution != nil {
		if !slices.Contains(types.SaleAttributionSources, body.Attribution.Source) {
			collected.Add("attribution.source", "must be post, clip or live")
		}
		utils.ParseIdentifier("attribution.id", body.Attribution.Id, &collected)
	}
	return collected.AsError()
}

func ValidateChangeQuantity(body dtos.ChangeQuantityRequest) error {
	var collected utils.Issues
	collected.CheckRange("quantity", body.Quantity, 1, 99)
	return collected.AsError()
}

func ValidateShippingQuote(body dtos.ShippingQuoteRequest) error {
	var collected utils.Issues
	utils.ParseIdentifier("addressId", body.AddressId, &collected)
	return collected.AsError()
}
