package errors

import (
	"net/http"

	"zudomart/platform/httpserver"
)

func Unprocessable(code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, code, message)
}

var UnsupportedCurrency = Unprocessable("UNSUPPORTED_CURRENCY", "That currency is not supported.")
