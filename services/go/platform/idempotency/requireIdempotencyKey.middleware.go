package idempotency

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"time"

	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

var idempotencyKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,128}$`)

const (
	DefaultTimeToLive      = 24 * time.Hour
	MoneyMovingTimeToLive  = 7 * 24 * time.Hour
	maximumHashedBodyBytes = httpserver.DefaultMaximumJsonBodyBytes
)

func IsValidIdempotencyKey(key string) bool {
	return idempotencyKeyPattern.MatchString(key)
}

func RequireIdempotencyKeyAndReplayCompletedResponses(store *RedisStore, ttl time.Duration, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			key := request.Header.Get("Idempotency-Key")
			if !IsValidIdempotencyKey(key) {
				httpserver.WriteJsonResponse(writer, http.StatusBadRequest, httpserver.NewApiError(http.StatusBadRequest, "IDEMPOTENCY_KEY_REQUIRED", "Send an Idempotency-Key header of 8-128 letters, digits, - or _."))
				return
			}
			body, err := io.ReadAll(http.MaxBytesReader(writer, request.Body, maximumHashedBodyBytes))
			if err != nil {
				httpserver.WriteJsonResponse(writer, http.StatusRequestEntityTooLarge, httpserver.NewApiError(http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "The request body is too large."))
				return
			}
			request.Body = io.NopCloser(bytes.NewReader(body))
			principal, _ := jwtauth.PrincipalFromContext(request.Context())
			scopedKey := hashParts(principal.UserId, request.Method, request.Pattern, key)
			requestHash := hashParts(string(body))
			outcome, stored, err := store.ReserveKeyOrLoadEarlierOutcome(request.Context(), scopedKey, requestHash, ttl)
			if err != nil {
				httpserver.WriteErrorResponse(writer, request, logger, err)
				return
			}
			switch outcome {
			case ReservationKeyReusedWithDifferentRequest:
				httpserver.WriteJsonResponse(writer, http.StatusUnprocessableEntity, httpserver.NewApiError(http.StatusUnprocessableEntity, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was used with a different request."))
				return
			case ReservationAlreadyInFlight:
				httpserver.WriteJsonResponse(writer, http.StatusConflict, httpserver.NewApiError(http.StatusConflict, "IDEMPOTENCY_IN_FLIGHT", "The same request is still being processed."))
				return
			case ReservationCompletedEarlier:
				writer.Header().Set("Content-Type", stored.ContentType)
				writer.Header().Set("Idempotent-Replayed", "true")
				writer.WriteHeader(stored.Status)
				_, _ = writer.Write(stored.Body)
				return
			}
			recorder := &bufferingResponseWriter{ResponseWriter: writer, status: http.StatusOK}
			next.ServeHTTP(recorder, request)
			if recorder.status >= http.StatusInternalServerError {
				_ = store.ReleaseKeySoTheClientCanRetry(request.Context(), scopedKey)
				return
			}
			response := StoredResponse{Status: recorder.status, ContentType: writer.Header().Get("Content-Type"), Body: recorder.body.Bytes()}
			if err := store.SaveCompletedResponse(request.Context(), scopedKey, requestHash, response, ttl); err != nil {
				logger.WarnContext(request.Context(), "could not store idempotent response", slog.Any("error", err))
			}
		})
	}
}

type bufferingResponseWriter struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (recorder *bufferingResponseWriter) WriteHeader(status int) {
	recorder.status = status
	recorder.ResponseWriter.WriteHeader(status)
}

func (recorder *bufferingResponseWriter) Write(chunk []byte) (int, error) {
	recorder.body.Write(chunk)
	return recorder.ResponseWriter.Write(chunk)
}

func hashParts(parts ...string) string {
	hasher := sha256.New()
	for _, part := range parts {
		hasher.Write([]byte(part))
		hasher.Write([]byte{0})
	}
	return hex.EncodeToString(hasher.Sum(nil))
}

func ReplayWhenIdempotencyKeyPresent(store *RedisStore, ttl time.Duration, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		replaying := RequireIdempotencyKeyAndReplayCompletedResponses(store, ttl, logger)(next)
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.Header.Get("Idempotency-Key") == "" || store == nil {
				next.ServeHTTP(writer, request)
				return
			}
			replaying.ServeHTTP(writer, request)
		})
	}
}
