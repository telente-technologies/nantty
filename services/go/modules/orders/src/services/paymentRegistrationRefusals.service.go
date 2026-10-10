package services

import (
	"errors"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/status"

	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/platform/httpserver"
)

var paymentRefusalsByReason = map[string]*httpserver.ApiError{
	"SELLER_SALES_CAP_REACHED":        ordererrors.SellerSalesCapReached,
	"DIRECT_PAYMENT_NOT_ALLOWED":      ordererrors.DirectPaymentNotAllowed,
	"SELLER_VERIFICATION_UNAVAILABLE": ordererrors.SellerVerificationUnavailable,
}

func PaymentRegistrationRefusal(err error) *httpserver.ApiError {
	var apiError *httpserver.ApiError
	if errors.As(err, &apiError) {
		return paymentRefusalsByReason[apiError.Code]
	}
	described, ok := status.FromError(err)
	if !ok {
		return nil
	}
	for _, detail := range described.Details() {
		if info, isInfo := detail.(*errdetails.ErrorInfo); isInfo {
			return paymentRefusalsByReason[info.GetReason()]
		}
	}
	return nil
}
