package utils

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/live/src/types"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type Responder struct {
	Logger *slog.Logger
}

func (responder Responder) Error(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, responder.Logger, err)
}

func (responder Responder) WithActorAndLive(writer http.ResponseWriter, request *http.Request, run func(types.Actor, uuid.UUID) error) {
	actor, err := ActorFrom(request)
	if err == nil {
		var liveId uuid.UUID
		if liveId, err = PathIdentifier(request, "liveId"); err == nil {
			err = run(actor, liveId)
		}
	}
	if err != nil {
		responder.Error(writer, request, err)
	}
}

func ActorFrom(request *http.Request) (types.Actor, error) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	userId, err := uuid.Parse(principal.UserId)
	if err != nil {
		return types.Actor{}, httpserver.ErrUnauthorized
	}
	return types.Actor{UserId: userId, Roles: principal.Roles}, nil
}

func PathIdentifier(request *http.Request, name string) (uuid.UUID, error) {
	identifier, err := uuid.Parse(request.PathValue(name))
	if err != nil {
		return uuid.Nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be a valid id"}})
	}
	return identifier, nil
}

func OrNotFound(err error) error {
	if err != nil {
		return err
	}
	return httpserver.ErrNotFound
}

func DecodeAndValidate[Request any](writer http.ResponseWriter, request *http.Request, validate func(Request) error) (Request, error) {
	var body Request
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		return body, err
	}
	return body, validate(body)
}

func ClientRegion(request *http.Request) string {
	region := strings.ToUpper(strings.TrimSpace(request.Header.Get("X-Client-Region")))
	if len(region) != 2 {
		return ""
	}
	return region
}

func PageParameters(request *http.Request, defaultLimit, maximumLimit int) (string, int, error) {
	limit := defaultLimit
	if raw := request.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > maximumLimit {
			return "", 0, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "limit", Message: "must be between 1 and " + strconv.Itoa(maximumLimit)}})
		}
		limit = parsed
	}
	return request.URL.Query().Get("cursor"), limit, nil
}

func DecodeOptionalBody[Request any](writer http.ResponseWriter, request *http.Request, validate func(Request) error) (Request, error) {
	var body Request
	if request.ContentLength == 0 && request.Header.Get("Transfer-Encoding") == "" {
		return body, nil
	}
	return DecodeAndValidate(writer, request, validate)
}
