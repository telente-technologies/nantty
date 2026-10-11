package httpserver

import "net/http"

const DefaultMaximumRequestBodyBytes int64 = 2 << 20

var ErrRequestBodyTooLarge = NewApiError(http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "The request body is too large.")

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
	tracker.wroteHeader = true
	tracker.ResponseWriter.WriteHeader(status)
}

func (tracker *headerTrackingResponseWriter) Write(chunk []byte) (int, error) {
	tracker.wroteHeader = true
	return tracker.ResponseWriter.Write(chunk)
}

func (tracker *headerTrackingResponseWriter) Unwrap() http.ResponseWriter {
	return tracker.ResponseWriter
}
