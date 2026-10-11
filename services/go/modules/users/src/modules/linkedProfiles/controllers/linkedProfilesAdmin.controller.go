package controllers

import (
	"net/http"

	usersErrors "zudomart/modules/users/src/errors"
	chooselinkedprofiles "zudomart/modules/users/src/modules/linkedProfiles/commands/chooseLinkedProfiles"
	convertlinkedprofile "zudomart/modules/users/src/modules/linkedProfiles/commands/convertLinkedProfile"
	"zudomart/modules/users/src/modules/linkedProfiles/dtos"
	listruleconflicts "zudomart/modules/users/src/modules/linkedProfiles/queries/listRuleConflicts"
	"zudomart/modules/users/src/modules/linkedProfiles/services"
	"zudomart/modules/users/src/utils"
)

func (controller LinkedProfilesController) AdminConflicts(writer http.ResponseWriter, request *http.Request) {
	page, err := listruleconflicts.Handler{Container: controller.Container}.Execute(request.Context())
	controller.respond(writer, request, http.StatusOK, page, err)
}

func (controller LinkedProfilesController) AdminSummary(writer http.ResponseWriter, request *http.Request) {
	accountId, err := pathAccount(request, "userId")
	var summary services.Summary
	if err == nil {
		summary, err = services.BuildSummary(request.Context(), controller.Container, accountId)
	}
	controller.respond(writer, request, http.StatusOK, summary, err)
}

func (controller LinkedProfilesController) AdminConvert(writer http.ResponseWriter, request *http.Request) {
	accountId, err := pathAccount(request, "userId")
	var body dtos.ConvertRequest
	if err == nil {
		body, err = utils.DecodeAndValidate(writer, request, acceptAny[dtos.ConvertRequest])
	}
	var summary services.Summary
	if err == nil {
		summary, err = convertlinkedprofile.Handler{Container: controller.Container}.Execute(request.Context(), convertlinkedprofile.Command{
			Actor: utils.StaffActorFromRequest(request), AccountId: accountId, ProfileId: body.ProfileId, ToKind: body.ToKind, Reason: body.Reason,
		})
	}
	controller.respond(writer, request, http.StatusOK, summary, err)
}

func (controller LinkedProfilesController) AdminResolve(writer http.ResponseWriter, request *http.Request) {
	accountId, err := pathAccount(request, "userId")
	var body dtos.ChooseRequest
	if err == nil {
		body, err = utils.DecodeAndValidate(writer, request, acceptAny[dtos.ChooseRequest])
	}
	if err == nil && (len(body.Reason) < 5 || len(body.Reason) > 500) {
		err = usersErrors.ValidationFailedFor("reason", "must be 5 to 500 characters")
	}
	var summary services.Summary
	if err == nil {
		actor := utils.StaffActorFromRequest(request)
		summary, err = chooselinkedprofiles.Handler{Container: controller.Container}.Execute(request.Context(), chooselinkedprofiles.Command{AccountId: accountId, Keep: body.Keep, Actor: &actor, Reason: body.Reason})
	}
	controller.respond(writer, request, http.StatusOK, summary, err)
}
