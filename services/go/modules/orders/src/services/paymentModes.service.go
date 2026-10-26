package services

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/enums"
	ordererrors "nantty/modules/orders/src/errors"
)

func ResolvePaymentModes(plan *CheckoutPlan, requested map[uuid.UUID]string, acceptedDirect bool) error {
	for index := range plan.Groups {
		group := &plan.Groups[index]
		group.PaymentMode = enums.PaymentModeEscrow
		mode, chosen := requested[group.Group.StoreId]
		if !chosen || mode == enums.PaymentModeEscrow {
			continue
		}
		if mode != enums.PaymentModeDirect || !acceptedDirect {
			return ordererrors.DirectPaymentNotAllowed
		}
		if !group.Store.Verified {
			return ordererrors.DirectPaymentNotAllowed
		}
		group.PaymentMode = enums.PaymentModeDirect
	}
	return nil
}
