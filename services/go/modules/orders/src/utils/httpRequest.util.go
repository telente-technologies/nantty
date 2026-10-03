package utils

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type Actor struct {
	UserId uuid.UUID
	Roles  []string
}

type Responder struct {
	Logger *slog.Logger
}

func (responder Responder) Error(writer http.ResponseWriter, request *http.Request, err error) {
	httpserver.WriteErrorResponse(writer, request, responder.Logger, err)
}

func ActorFrom(request *http.Request) (Actor, error) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	userId, err := uuid.Parse(principal.UserId)
	if err != nil {
		return Actor{}, httpserver.ErrUnauthorized
	}
	return Actor{UserId: userId, Roles: principal.Roles}, nil
}

func PathIdentifier(request *http.Request, name string) (uuid.UUID, error) {
	identifier, err := uuid.Parse(request.PathValue(name))
	if err != nil {
		return uuid.Nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be a valid id"}})
	}
	return identifier, nil
}

func OptionalQueryIdentifier(request *http.Request, name string) (*uuid.UUID, error) {
	raw := request.URL.Query().Get(name)
	if raw == "" {
		return nil, nil
	}
	identifier, err := uuid.Parse(raw)
	if err != nil {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be a valid id"}})
	}
	return &identifier, nil
}

func DecodeAndValidate[Request any](writer http.ResponseWriter, request *http.Request, validate func(Request) error) (Request, error) {
	var body Request
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		return body, err
	}
	return body, validate(body)
}

func ReadPageLimit(request *http.Request, defaultLimit, maximumLimit int) (int, error) {
	raw := request.URL.Query().Get("limit")
	if raw == "" {
		return defaultLimit, nil
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit < 1 || limit > maximumLimit {
		return 0, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "limit", Message: "must be between 1 and " + strconv.Itoa(maximumLimit)}})
	}
	return limit, nil
}

func NeverNil[Item any](items []Item) []Item {
	if items == nil {
		return []Item{}
	}
	return items
}
