package controllers

import (
	"net/http"

	"zudomart/modules/moderation/src/container"
	issuestrike "zudomart/modules/moderation/src/modules/strikes/commands/issueStrike"
	revokestrike "zudomart/modules/moderation/src/modules/strikes/commands/revokeStrike"
	"zudomart/modules/moderation/src/modules/strikes/dtos"
	countaccountstrikes "zudomart/modules/moderation/src/modules/strikes/queries/countAccountStrikes"
	listaccountstrikes "zudomart/modules/moderation/src/modules/strikes/queries/listAccountStrikes"
	"zudomart/platform/httpserver"
)

type StrikesController struct {
	Container *container.Container
}

func (controller StrikesController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller StrikesController) ListForAccount(writer http.ResponseWriter, request *http.Request) {
	result, err := listaccountstrikes.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("accountId"), request.URL.Query().Get("includeInactive") == "true")
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StrikesController) Counts(writer http.ResponseWriter, request *http.Request) {
	var body dtos.CountStrikesRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := countaccountstrikes.Handler{Container: controller.Container}.Execute(request.Context(), body.AccountIds)
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StrikesController) Issue(writer http.ResponseWriter, request *http.Request) {
	var body dtos.IssueStrikeRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := issuestrike.Handler{Container: controller.Container}.Execute(request.Context(), issuestrike.Command{
		AccountId: request.PathValue("accountId"), Kind: body.Kind, Policy: body.Policy, Reason: body.Reason, Source: body.Source, IssuedById: body.IssuedById, IssuedByName: body.IssuedByName,
		ReferenceType: body.ReferenceType, ReferenceId: body.ReferenceId, ExpiresInDays: body.ExpiresInDays,
	})
	status := http.StatusCreated
	if err == nil && !result.Created {
		status = http.StatusOK
	}
	controller.respond(writer, request, status, result, err)
}

func (controller StrikesController) Revoke(writer http.ResponseWriter, request *http.Request) {
	var body dtos.RevokeStrikeRequest
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	if err := (revokestrike.Handler{Container: controller.Container}).Execute(request.Context(), request.PathValue("strikeId"), body.Reason); err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
