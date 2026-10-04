package controllers

import (
	"net/http"
	"strconv"

	decideverificationcase "zudomart/modules/users/src/modules/identityVerification/commands/decideVerificationCase"
	"zudomart/modules/users/src/modules/identityVerification/dtos"
	getverificationcase "zudomart/modules/users/src/modules/identityVerification/queries/getVerificationCase"
	listverificationcases "zudomart/modules/users/src/modules/identityVerification/queries/listVerificationCases"
	"zudomart/modules/users/src/utils"
)

func (controller IdentityVerificationController) ListCases(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	limit, _ := strconv.Atoi(query.Get("limit"))
	items, err := listverificationcases.Handler{Container: controller.Container}.Execute(request.Context(), listverificationcases.Query{Status: query.Get("status"), Limit: limit})
	controller.respond(writer, request, http.StatusOK, map[string]any{"data": items}, err)
}

func (controller IdentityVerificationController) GetCase(writer http.ResponseWriter, request *http.Request) {
	result, err := getverificationcase.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("caseId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IdentityVerificationController) DecisionHandler(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.DecisionRequest])
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		result, err := decideverificationcase.Handler{Container: controller.Container}.Execute(request.Context(), decideverificationcase.Command{
			Actor: utils.StaffActorFromRequest(request), CaseId: request.PathValue("caseId"), Action: action, Reason: body.Reason,
		})
		controller.respond(writer, request, http.StatusOK, result, err)
	}
}
