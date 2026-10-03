package validators

import (
	"zudomart/modules/orders/src/modules/orders/dtos"
	"zudomart/modules/orders/src/utils"
)

func ValidateCheckout(body dtos.CheckoutRequest) error {
	var collected utils.Issues
	utils.ParseIdentifier("addressId", body.AddressId, &collected)
	collected.CheckRange("promoCodes", len(body.PromoCodes), 0, 20)
	for _, promo := range body.PromoCodes {
		utils.ParseIdentifier("promoCodes.storeId", promo.StoreId, &collected)
		collected.CheckLength("promoCodes.code", promo.Code, 3, 24)
	}
	return collected.AsError()
}

func ValidateCancel(body dtos.CancelOrderRequest) error {
	var collected utils.Issues
	collected.CheckLength("reason", body.Reason, 5, 500)
	return collected.AsError()
}
