package controllers

import (
	"net/http"

	assignheldusername "zudomart/modules/users/src/modules/accountEnforcement/commands/assignHeldUsername"
	decidesuspensionappeal "zudomart/modules/users/src/modules/accountEnforcement/commands/decideSuspensionAppeal"
	reassignusername "zudomart/modules/users/src/modules/accountEnforcement/commands/reassignUsername"
	reinstateuser "zudomart/modules/users/src/modules/accountEnforcement/commands/reinstateUser"
	submitsuspensionappeal "zudomart/modules/users/src/modules/accountEnforcement/commands/submitSuspensionAppeal"
	"zudomart/modules/users/src/modules/accountEnforcement/dtos"
	getmysuspension "zudomart/modules/users/src/modules/accountEnforcement/queries/getMySuspension"
	getusernamehold "zudomart/modules/users/src/modules/accountEnforcement/queries/getUsernameHold"
	listheldusernames "zudomart/modules/users/src/modules/accountEnforcement/queries/listHeldUsernames"
	listsuspendedaccounts "zudomart/modules/users/src/modules/accountEnforcement/queries/listSuspendedAccounts"
	"zudomart/modules/users/src/utils"
	"zudomart/platform/httpserver"
)

func (controller AccountEnforcementController) Reassign(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReassignRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := reassignusername.Handler{Container: controller.Container}.Execute(request.Context(), reassignusername.Command{
		Actor: utils.StaffActorFromRequest(request), OwnerId: request.PathValue("userId"), RecipientUserId: body.RecipientUserId, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) AssignHeld(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.AssignHeldRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := assignheldusername.Handler{Container: controller.Container}.Execute(request.Context(), assignheldusername.Command{
		Actor: utils.StaffActorFromRequest(request), TargetId: request.PathValue("userId"), Username: body.Username, Reason: body.Reason, BypassHold: body.BypassHold,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) ListHeld(writer http.ResponseWriter, request *http.Request) {
	result, err := listheldusernames.Handler{Container: controller.Container}.Execute(request.Context())
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) GetHold(writer http.ResponseWriter, request *http.Request) {
	result, err := getusernamehold.Handler{Container: controller.Container}.Execute(request.Context(), request.URL.Query().Get("username"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) ListSuspendedAccounts(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listsuspendedaccounts.Handler{Container: controller.Container}.Execute(request.Context(), listsuspendedaccounts.Query{PendingAppealOnly: query.Get("appeal") == "PENDING", Search: query.Get("search"), Cursor: query.Get("cursor")})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) ReinstateSuspension(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReasonRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	_, err = reinstateuser.Handler{Container: controller.Container}.Execute(request.Context(), reinstateuser.Command{
		Actor: utils.StaffActorFromRequest(request), SuspensionId: request.PathValue("caseId"), Reason: body.Reason, AuditAction: "suspension.reinstated",
	})
	controller.respond(writer, request, http.StatusOK, map[string]bool{"reinstated": true}, err)
}

func (controller AccountEnforcementController) DecideAppeal(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.AppealDecisionRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	outcome, err := decidesuspensionappeal.Handler{Container: controller.Container}.Execute(request.Context(), decidesuspensionappeal.Command{
		Actor: utils.StaffActorFromRequest(request), SuspensionId: request.PathValue("caseId"), Outcome: body.Outcome, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, map[string]string{"outcome": outcome}, err)
}

func (controller AccountEnforcementController) MySuspension(writer http.ResponseWriter, request *http.Request) {
	result, err := getmysuspension.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller AccountEnforcementController) SubmitAppeal(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.AppealRequest])
	if err == nil {
		err = submitsuspensionappeal.Handler{Container: controller.Container}.Execute(request.Context(), submitsuspensionappeal.Command{AccountId: utils.AccountIdFromRequest(request), Message: body.Message})
	}
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
