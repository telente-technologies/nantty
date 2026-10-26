package utils

import (
	"net/http"
	"regexp"

	"nantty/platform/httpserver"
)

var SixDigitCodePattern = regexp.MustCompile(`^\d{6}$`)

func DecodeAndValidate[Request any](writer http.ResponseWriter, request *http.Request, validate func(Request) error) (Request, error) {
	var body Request
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		return body, err
	}
	return body, validate(body)
}
