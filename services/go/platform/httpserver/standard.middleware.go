package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"regexp"
	"time"
)

type requestIdContextKey struct{}

var acceptableRequestIdPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{8,128}$`)

func RequestIdFromContext(ctx context.Context) string {
	value, _ := ctx.Value(requestIdContextKey{}).(string)
	return value
}

func AssignRequestIdToEveryRequest(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestId := request.Header.Get("X-Request-Id")
		if !acceptableRequestIdPattern.MatchString(requestId) {
			requestId = generateRandomRequestId()
		}
		writer.Header().Set("X-Request-Id", requestId)
		next.ServeHTTP(writer, request.WithContext(context.WithValue(request.Context(), requestIdContextKey{}, requestId)))
	})
}

func RecoverFromPanicsAsInternalErrors(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			defer func() {
				if recovered := recover(); recovered != nil {
					logger.ErrorContext(request.Context(), "panic while handling request", slog.Any("panic", recovered), slog.String("path", request.URL.Path))
					WriteJsonResponse(writer, http.StatusInternalServerError, ConvertErrorToApiError(nil))
				}
			}()
			next.ServeHTTP(writer, request)
		})
	}
}

func LogEveryRequestWithDuration(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			startedAt := time.Now()
			recorder := &statusRecordingResponseWriter{ResponseWriter: writer, status: http.StatusOK}
			next.ServeHTTP(recorder, request)
			logger.InfoContext(request.Context(), "request",
				slog.String("method", request.Method),
				slog.String("path", request.URL.Path),
				slog.Int("status", recorder.status),
				slog.Duration("duration", time.Since(startedAt)),
				slog.String("requestId", RequestIdFromContext(request.Context())),
			)
		})
	}
}

func ChainMiddlewares(handler http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	for index := len(middlewares) - 1; index >= 0; index-- {
		handler = middlewares[index](handler)
	}
	return handler
}

type statusRecordingResponseWriter struct {
	http.ResponseWriter
	status int
}

func (recorder *statusRecordingResponseWriter) WriteHeader(status int) {
	recorder.status = status
	recorder.ResponseWriter.WriteHeader(status)
}

func (recorder *statusRecordingResponseWriter) Unwrap() http.ResponseWriter {
	return recorder.ResponseWriter
}

func generateRandomRequestId() string {
	buffer := make([]byte, 12)
	_, _ = rand.Read(buffer)
	return hex.EncodeToString(buffer)
}
