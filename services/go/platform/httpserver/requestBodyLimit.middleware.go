package httpserver

import (
	"net/http"
	"strings"
)

const DefaultMaximumRequestBodyBytes int64 = 2 << 20

var ErrRequestBodyTooLarge = NewApiError(http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "The request body is too large.")

type ResponseContentTypeDecision uint8

const (
	ContentTypeSafe ResponseContentTypeDecision = iota
	ContentTypeMissing
	ContentTypeDisallowed
)

func ClassifyResponseContentType(contentType string) ResponseContentTypeDecision {
	mediaType := strings.ToLower(strings.TrimSpace(strings.SplitN(contentType, ";", 2)[0]))
	switch mediaType {
	case "application/json", "application/problem+json", "application/jwk-set+json", "application/x-ndjson", "text/plain", "text/csv", "application/pdf", "application/octet-stream":
		return ContentTypeSafe
	case "":
		return ContentTypeMissing
	default:
		return ContentTypeDisallowed
	}
}

func EnsureSafeResponseContentType(writer http.ResponseWriter) {
	headers := writer.Header()
	if strings.TrimSpace(headers.Get("X-Content-Type-Options")) == "" {
		headers.Set("X-Content-Type-Options", "nosniff")
	}
	switch ClassifyResponseContentType(headers.Get("Content-Type")) {
	case ContentTypeMissing:
		headers.Set("Content-Type", "text/plain; charset=utf-8")
	case ContentTypeDisallowed:
		headers.Set("Content-Type", "application/octet-stream")
	}
}

func LimitEveryRequestBody(maximumBytes int64) func(http.Handler) http.Handler {
	if maximumBytes <= 0 {
		maximumBytes = DefaultMaximumRequestBodyBytes
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.ContentLength > maximumBytes {
				WriteJsonResponse(writer, http.StatusRequestEntityTooLarge, ErrRequestBodyTooLarge)
				return
			}
			if request.Body != nil && request.Body != http.NoBody {
				request.Body = http.MaxBytesReader(writer, request.Body, maximumBytes)
			}
			next.ServeHTTP(writer, request)
		})
	}
}

type headerTrackingResponseWriter struct {
	http.ResponseWriter
	wroteHeader bool
}

func (tracker *headerTrackingResponseWriter) WriteHeader(status int) {
	if !tracker.wroteHeader && status != http.StatusNoContent && status != http.StatusNotModified {
		EnsureSafeResponseContentType(tracker.ResponseWriter)
	}
	tracker.wroteHeader = true
	tracker.ResponseWriter.WriteHeader(status)
}

func (tracker *headerTrackingResponseWriter) Write(chunk []byte) (int, error) {
	responseWriter := tracker.ResponseWriter
	headers := responseWriter.Header()
	if strings.TrimSpace(headers.Get("X-Content-Type-Options")) == "" {
		headers.Set("X-Content-Type-Options", "nosniff")
	}
	switch ClassifyResponseContentType(headers.Get("Content-Type")) {
	case ContentTypeMissing:
		headers.Set("Content-Type", "text/plain; charset=utf-8")
	case ContentTypeDisallowed:
		headers.Set("Content-Type", "application/octet-stream")
	}
	tracker.wroteHeader = true
	return responseWriter.Write(chunk)
}

func (tracker *headerTrackingResponseWriter) Unwrap() http.ResponseWriter {
	return tracker.ResponseWriter
}
