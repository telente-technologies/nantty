package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
)

const DefaultMaximumJsonBodyBytes = 1 << 20

func WriteJsonResponse(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("Cache-Control", "no-store")
	writer.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(writer).Encode(body)
	}
}

func WriteNoContentResponse(writer http.ResponseWriter) {
	writer.WriteHeader(http.StatusNoContent)
}

func WriteErrorResponse(writer http.ResponseWriter, request *http.Request, logger *slog.Logger, err error) {
	apiError := ConvertErrorToApiError(err)
	if apiError.Status >= http.StatusInternalServerError {
		logger.ErrorContext(request.Context(), "request failed", slog.String("path", request.URL.Path), slog.Any("error", err))
	}
	WriteJsonResponse(writer, apiError.Status, apiError)
}

func DecodeJsonBodyRejectingUnknownFields(writer http.ResponseWriter, request *http.Request, destination any) error {
	request.Body = http.MaxBytesReader(writer, request.Body, DefaultMaximumJsonBodyBytes)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			return NewApiError(http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "The request body is too large.")
		}
		if errors.Is(err, io.EOF) {
			return NewApiError(http.StatusBadRequest, "INVALID_JSON", "The request body is empty.")
		}
		return NewApiError(http.StatusBadRequest, "INVALID_JSON", "The request body is not valid JSON.")
	}
	if decoder.More() {
		return NewApiError(http.StatusBadRequest, "INVALID_JSON", "The request body must be a single JSON object.")
	}
	return nil
}
