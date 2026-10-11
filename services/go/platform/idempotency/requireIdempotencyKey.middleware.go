package idempotency

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"slices"
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

var retryableClientStatuses = []int{
	http.StatusUnauthorized, http.StatusPaymentRequired, http.StatusForbidden, http.StatusRequestTimeout,
	http.StatusConflict, http.StatusLocked, http.StatusTooEarly, http.StatusTooManyRequests,
}

var IdempotencyStoreUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "IDEMPOTENCY_UNAVAILABLE", "This action is temporarily unavailable. Try again shortly.")

type reservationStore interface {
	ReserveKeyOrLoadEarlierOutcome(ctx context.Context, scopedKey, requestHash string, ttl time.Duration) (ReservationOutcome, *StoredResponse, string, error)
	SaveCompletedResponse(ctx context.Context, scopedKey, requestHash, owner string, response StoredResponse, ttl time.Duration) error
	ReleaseKeySoTheClientCanRetry(ctx context.Context, scopedKey, owner string) error
}

func IsValidIdempotencyKey(key string) bool {
	return idempotencyKeyPattern.MatchString(key)
}

func RequireIdempotencyKeyAndReplayCompletedResponses(store *RedisStore, ttl time.Duration, logger *slog.Logger) func(http.Handler) http.Handler {
	if store == nil {
		return refuseWithoutStore
	}
	return requireIdempotencyKeyWithStore(store, ttl, logger)
}

func refuseWithoutStore(http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		httpserver.WriteJsonResponse(writer, http.StatusServiceUnavailable, IdempotencyStoreUnavailable)
	})
}

func requireIdempotencyKeyWithStore(store reservationStore, ttl time.Duration, logger *slog.Logger) func(http.Handler) http.Handler {
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
			scopedKey := hashParts(principal.UserId, request.Method, request.Pattern, request.URL.EscapedPath(), key)
			requestHash := hashParts(string(body))
			outcome, stored, owner, err := store.ReserveKeyOrLoadEarlierOutcome(request.Context(), scopedKey, requestHash, ttl)
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
			recorder := &bufferingResponseWriter{header: writer.Header(), status: http.StatusOK}
			serveReleasingOnPanic(request.Context(), store, scopedKey, owner, next, recorder, request)
			if recorder.status >= http.StatusInternalServerError || slices.Contains(retryableClientStatuses, recorder.status) {
				if err := store.ReleaseKeySoTheClientCanRetry(context.WithoutCancel(request.Context()), scopedKey, owner); err != nil {
					logger.WarnContext(request.Context(), "could not release idempotency key", slog.Any("error", err))
				}
			} else {
				response := StoredResponse{Status: recorder.status, ContentType: writer.Header().Get("Content-Type"), Body: recorder.body.Bytes()}
				if err := store.SaveCompletedResponse(context.WithoutCancel(request.Context()), scopedKey, requestHash, owner, response, ttl); err != nil {
					logger.WarnContext(request.Context(), "could not store idempotent response", slog.Any("error", err))
				}
			}
			writer.WriteHeader(recorder.status)
			_, _ = writer.Write(recorder.body.Bytes())
		})
	}
}

func serveReleasingOnPanic(ctx context.Context, store reservationStore, scopedKey, owner string, next http.Handler, recorder *bufferingResponseWriter, request *http.Request) {
	defer func() {
		if recovered := recover(); recovered != nil {
			_ = store.ReleaseKeySoTheClientCanRetry(context.WithoutCancel(ctx), scopedKey, owner)
			panic(recovered)
		}
	}()
	next.ServeHTTP(recorder, request)
}

type bufferingResponseWriter struct {
	header      http.Header
	status      int
	wroteHeader bool
	body        bytes.Buffer
}

func (recorder *bufferingResponseWriter) Header() http.Header { return recorder.header }

func (recorder *bufferingResponseWriter) WriteHeader(status int) {
	if recorder.wroteHeader {
		return
	}
	recorder.wroteHeader = true
	recorder.status = status
}

func (recorder *bufferingResponseWriter) Write(chunk []byte) (int, error) {
	recorder.wroteHeader = true
	return recorder.body.Write(chunk)
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
		if store == nil {
			return next
		}
		replaying := requireIdempotencyKeyWithStore(store, ttl, logger)(next)
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.Header.Get("Idempotency-Key") == "" {
				next.ServeHTTP(writer, request)
				return
			}
			replaying.ServeHTTP(writer, request)
		})
	}
}
