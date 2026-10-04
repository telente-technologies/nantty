package services

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/enums"
	ordererrors "zudomart/modules/orders/src/errors"
)

// ResolvePaymentModes sets each planned group's payment mode. Direct payment is only
// allowed for verified stores; everything else is escrow.
func ResolvePaymentModes(plan *CheckoutPlan, requested map[uuid.UUID]string) error {
	for index := range plan.Groups {
		group := &plan.Groups[index]
		group.PaymentMode = enums.PaymentModeEscrow
		mode, chosen := requested[group.Group.StoreId]
		if !chosen || mode == enums.PaymentModeEscrow {
			continue
		}
		if mode != enums.PaymentModeDirect {
			return ordererrors.DirectPaymentNotAllowed
		}
		if !group.Store.Verified {
			return ordererrors.DirectPaymentNotAllowed
		}
		group.PaymentMode = enums.PaymentModeDirect
	}
	return nil
}
