package validators

import (
	"zudomart/modules/orders/src/enums"
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
	collected.CheckRange("paymentModes", len(body.PaymentModes), 0, 20)
	for _, choice := range body.PaymentModes {
		utils.ParseIdentifier("paymentModes.storeId", choice.StoreId, &collected)
		if choice.Mode != enums.PaymentModeEscrow && choice.Mode != enums.PaymentModeDirect {
			collected.Add("paymentModes.paymentMode", "must be escrow or direct")
		}
	}
	return collected.AsError()
}

func ValidateCancel(body dtos.CancelOrderRequest) error {
	var collected utils.Issues
	collected.CheckLength("reason", body.Reason, 5, 500)
	return collected.AsError()
}
