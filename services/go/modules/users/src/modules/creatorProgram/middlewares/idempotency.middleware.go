package middlewares

import (
	"net/http"

	"nantty/platform/httpserver"
	"nantty/platform/idempotency"
)

func RequireCreatorApplicationIdempotencyKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if !idempotency.IsValidIdempotencyKey(request.Header.Get("Idempotency-Key")) {
			httpserver.WriteJsonResponse(writer, http.StatusBadRequest, httpserver.NewApiError(http.StatusBadRequest, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header of 8-128 letters, digits, - or _."))
			return
		}
		next.ServeHTTP(writer, request)
	})
}
