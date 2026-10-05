package controllers

import (
	"net/http"

	usersErrors "zudomart/modules/users/src/errors"
	forcelogout "zudomart/modules/users/src/modules/accountEnforcement/commands/forceLogout"
	reclaimwithheldusername "zudomart/modules/users/src/modules/accountEnforcement/commands/reclaimWithheldUsername"
	warnuser "zudomart/modules/users/src/modules/accountEnforcement/commands/warnUser"
	withholdaccountusername "zudomart/modules/users/src/modules/accountEnforcement/commands/withholdAccountUsername"
	"zudomart/modules/users/src/modules/accountEnforcement/dtos"
	listwithheldusernames "zudomart/modules/users/src/modules/accountEnforcement/queries/listWithheldUsernames"
	previewusernameconfusables "zudomart/modules/users/src/modules/accountEnforcement/queries/previewUsernameConfusables"
	revealpersonaldata "zudomart/modules/users/src/modules/accountEnforcement/queries/revealPersonalData"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	"zudomart/modules/users/src/utils"
)

func (controller AccountEnforcementController) RevealPersonalData(writer http.ResponseWriter, request *http.Request) {
	result, err := revealpersonaldata.Handler{Container: controller.Container}.Execute(request.Context(), revealpersonaldata.Query{
		Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), Purpose: request.URL.Query().Get("purpose"),
	})
	writer.Header().Set("Cache-Control", "no-store")
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) Warn(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.WarnRequest])
	if err == nil && body.AddStrike {
		err = usersErrors.UnprocessableWithCode("STRIKES_NOT_SUPPORTED", "Strikes are issued from the trust queues. Send the warning without a strike.")
	}
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	_, err = warnuser.Handler{Container: controller.Container}.Execute(request.Context(), warnuser.Command{
		Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), Reason: body.Reason, Policy: body.Policy, Source: "admin",
	})
	controller.respondWithUserDetail(writer, request, err)
}

func (controller AccountEnforcementController) ForceLogout(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ForceLogoutRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := forcelogout.Handler{Container: controller.Container}.Execute(request.Context(), forcelogout.Command{
		Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), Reason: body.Reason, SessionId: body.SessionId,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) WithholdUsername(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReasonRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := withholdaccountusername.Handler{Container: controller.Container}.Execute(request.Context(), withholdaccountusername.Command{
		Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) ReclaimUsername(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReclaimRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := reclaimwithheldusername.Handler{Container: controller.Container}.Execute(request.Context(), reclaimwithheldusername.Command{
		Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), Reason: body.Reason, Mode: body.Mode, ClaimantUserId: body.ClaimantUserId,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) ListWithheld(writer http.ResponseWriter, request *http.Request) {
	result, err := listwithheldusernames.Handler{Container: controller.Container}.Execute(request.Context())
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) PreviewConfusables(writer http.ResponseWriter, request *http.Request) {
	result, err := previewusernameconfusables.Handler{Container: controller.Container}.Execute(request.Context(), request.URL.Query().Get("candidate"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) respondWithUserDetail(writer http.ResponseWriter, request *http.Request, err error) {
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	target, err := services.LoadTarget(request.Context(), controller.Container, request.PathValue("userId"))
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	detail, err := services.BuildUserDetail(request.Context(), controller.Container, target)
	controller.respond(writer, request, http.StatusOK, detail, err)
}
