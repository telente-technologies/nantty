package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strings"
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
			tracker := &headerTrackingResponseWriter{ResponseWriter: writer}
			defer func() {
				if recovered := recover(); recovered != nil {
					logger.ErrorContext(request.Context(), "panic while handling request", slog.Any("panic", recovered), slog.String("path", request.URL.Path))
					if !tracker.wroteHeader {
						WriteJsonResponse(writer, http.StatusInternalServerError, ConvertErrorToApiError(nil))
					}
				}
			}()
			next.ServeHTTP(tracker, request)
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

func ApplySecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		headers := writer.Header()
		headers.Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'")
		headers.Set("X-Content-Type-Options", "nosniff")
		headers.Set("X-Frame-Options", "DENY")
		headers.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		headers.Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		headers.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		headers.Set("X-XSS-Protection", "0")
		next.ServeHTTP(writer, request)
	})
}

func ApplyCors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		origin := strings.TrimSpace(request.Header.Get("Origin"))
		allowedOrigins := parseAllowedOriginsFromEnvironment()
		if origin == "" || len(allowedOrigins) == 0 {
			next.ServeHTTP(writer, request)
			return
		}
		allowedOrigin := ""
		for _, candidate := range allowedOrigins {
			if candidate == "*" || strings.EqualFold(candidate, origin) {
				allowedOrigin = candidate
				break
			}
		}
		if allowedOrigin == "" {
			next.ServeHTTP(writer, request)
			return
		}
		header := writer.Header()
		header.Set("Vary", "Origin")
		header.Set("Access-Control-Allow-Origin", allowedOrigin)
		header.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		header.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id, Idempotency-Key, X-Step-Up-Token")
		header.Set("Access-Control-Max-Age", "600")
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func parseAllowedOriginsFromEnvironment() []string {
	value := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
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
