package errors

import (
	"net/http"

	"nantty/platform/httpserver"
)

func Unprocessable(code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, code, message)
}

var UnsupportedCurrency = Unprocessable("UNSUPPORTED_CURRENCY", "That currency is not supported.")

var RateUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "EXCHANGE_RATE_UNAVAILABLE", "An exchange rate is not available right now. Try again later.")
