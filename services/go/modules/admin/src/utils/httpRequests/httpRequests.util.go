package httprequests

import (
	"log/slog"
	"net/http"

	"nantty/platform/httpserver"
)

func DecodeAndValidate[Request any](writer http.ResponseWriter, request *http.Request, validate func(Request) error) (Request, error) {
	var body Request
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		return body, err
	}
	return body, validate(body)
}

func RespondWithError(writer http.ResponseWriter, request *http.Request, logger *slog.Logger, err error) {
	httpserver.WriteErrorResponse(writer, request, logger, err)
}

func RespondNoContentOrError(writer http.ResponseWriter, request *http.Request, logger *slog.Logger, err error) {
	if err != nil {
		RespondWithError(writer, request, logger, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
