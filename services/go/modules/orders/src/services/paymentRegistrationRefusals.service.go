package services

import (
	"encoding/json"
	"errors"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/status"

	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/platform/httpserver"
)

var paymentRefusalsByReason = map[string]*httpserver.ApiError{
	"SELLER_SALES_CAP_REACHED":        ordererrors.SellerSalesCapReached,
	"VERIFICATION_REQUIRED":           ordererrors.SellerVerificationRequiredToSell,
	"VERIFICATION_UNAVAILABLE":        ordererrors.SellerVerificationUnavailable,
	"DIRECT_PAYMENT_NOT_ALLOWED":      ordererrors.DirectPaymentNotAllowed,
	"SELLER_VERIFICATION_UNAVAILABLE": ordererrors.SellerVerificationUnavailable,
	"SELLER_DEBT_LIMIT":               ordererrors.SellerDebtLimit,
	"PAYMENT_AMOUNT_OUT_OF_RANGE":     ordererrors.PaymentAmountOutOfRange,
}

func PaymentRegistrationRefusal(err error) *httpserver.ApiError {
	var apiError *httpserver.ApiError
	if errors.As(err, &apiError) {
		return withRefusalDetails(paymentRefusalsByReason[apiError.Code], apiError.Details)
	}
	described, ok := status.FromError(err)
	if !ok {
		return nil
	}
	for _, detail := range described.Details() {
		if info, isInfo := detail.(*errdetails.ErrorInfo); isInfo {
			var details map[string]any
			if raw := info.GetMetadata()["details"]; raw != "" {
				_ = json.Unmarshal([]byte(raw), &details)
			}
			return withRefusalDetails(paymentRefusalsByReason[info.GetReason()], details)
		}
	}
	return nil
}

func withRefusalDetails(refusal *httpserver.ApiError, details map[string]any) *httpserver.ApiError {
	if refusal == nil {
		return nil
	}
	merged := map[string]any{"audience": "buyer"}
	for key, value := range details {
		merged[key] = value
	}
	return refusal.WithDetails(merged)
}
