package controllers

import (
	openverificationdocument "nantty/modules/users/src/modules/checkmarks/queries/openVerificationDocument"
	"net/http"

	createaccountbyadmin "nantty/modules/users/src/modules/checkmarks/commands/createAccountByAdmin"
	grantlifetimecheckmark "nantty/modules/users/src/modules/checkmarks/commands/grantLifetimeCheckmark"
	revokelifetimecheckmark "nantty/modules/users/src/modules/checkmarks/commands/revokeLifetimeCheckmark"
	transitionblackapplication "nantty/modules/users/src/modules/checkmarks/commands/transitionBlackApplication"
	transitionverification "nantty/modules/users/src/modules/checkmarks/commands/transitionVerification"
	"nantty/modules/users/src/modules/checkmarks/dtos"
	getverification "nantty/modules/users/src/modules/checkmarks/queries/getVerification"
	listadmincreatedaccounts "nantty/modules/users/src/modules/checkmarks/queries/listAdminCreatedAccounts"
	listblackapplications "nantty/modules/users/src/modules/checkmarks/queries/listBlackApplications"
	listcheckmarkgrants "nantty/modules/users/src/modules/checkmarks/queries/listCheckmarkGrants"
	listverifications "nantty/modules/users/src/modules/checkmarks/queries/listVerifications"
	"nantty/modules/users/src/utils"
)

func (controller CheckmarksController) ListVerifications(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listverifications.Handler{Container: controller.Container}.Execute(request.Context(), query.Get("status"), query.Get("color"), query.Get("cursor"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CheckmarksController) GetVerification(writer http.ResponseWriter, request *http.Request) {
	result, err := getverification.Handler{Container: controller.Container}.Execute(request.Context(), request.PathValue("verificationId"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CheckmarksController) OpenVerificationDocument(writer http.ResponseWriter, request *http.Request) {
	result, err := openverificationdocument.Handler{Container: controller.Container}.Execute(request.Context(), utils.StaffActorFromRequest(request), request.PathValue("verificationId"), request.PathValue("documentId"))
	writer.Header().Set("Cache-Control", "no-store")
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CheckmarksController) transition(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReasonRequest])
		if err == nil {
			err = transitionverification.Handler{Container: controller.Container}.Execute(request.Context(), transitionverification.Command{
				Actor: utils.StaffActorFromRequest(request), ApplicationId: request.PathValue("verificationId"), Action: action, Reason: body.Reason,
			})
		}
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		controller.GetVerification(writer, request)
	}
}

func (controller CheckmarksController) ListGrants(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listcheckmarkgrants.Handler{Container: controller.Container}.Execute(request.Context(), query.Get("status"), query.Get("cursor"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CheckmarksController) Grant(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.GrantRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := grantlifetimecheckmark.Handler{Container: controller.Container}.Execute(request.Context(), grantlifetimecheckmark.Command{Actor: utils.StaffActorFromRequest(request), Username: body.Username, Color: body.Color, Reason: body.Reason})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller CheckmarksController) RevokeGrant(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReasonRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := revokelifetimecheckmark.Handler{Container: controller.Container}.Execute(request.Context(), revokelifetimecheckmark.Command{Actor: utils.StaffActorFromRequest(request), GrantId: request.PathValue("grantId"), Reason: body.Reason})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CheckmarksController) ListCreatedAccounts(writer http.ResponseWriter, request *http.Request) {
	result, err := listadmincreatedaccounts.Handler{Container: controller.Container}.Execute(request.Context(), request.URL.Query().Get("cursor"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CheckmarksController) CreateAccount(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.CreateAccountRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := createaccountbyadmin.Handler{Container: controller.Container}.Execute(request.Context(), createaccountbyadmin.Command{
		Actor: utils.StaffActorFromRequest(request), Username: body.Username, DisplayName: body.DisplayName, Email: body.Email, Password: body.Password, Country: body.Country, ProfileType: body.ProfileType, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller CheckmarksController) ListBlack(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := listblackapplications.Handler{Container: controller.Container}.Execute(request.Context(), query.Get("status"), query.Get("search"), query.Get("cursor"))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller CheckmarksController) blackTransition(action string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var reason, key, note string
		var verified bool
		if action == transitionblackapplication.ActionChecklist {
			body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ChecklistRequest])
			if err != nil {
				controller.respond(writer, request, 0, nil, err)
				return
			}
			key, note, verified = body.Key, body.Note, body.IsVerified
		} else if action != transitionblackapplication.ActionReminder {
			body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.ReasonRequest])
			if err != nil {
				controller.respond(writer, request, 0, nil, err)
				return
			}
			reason = body.Reason
		}
		err := transitionblackapplication.Handler{Container: controller.Container}.Execute(request.Context(), transitionblackapplication.Command{
			Actor: utils.StaffActorFromRequest(request), Id: request.PathValue("blackId"), Action: action, Key: key, IsVerified: verified, Note: note, Reason: reason,
		})
		if err != nil {
			controller.respond(writer, request, 0, nil, err)
			return
		}
		controller.respondBlack(writer, request)
	}
}

func (controller CheckmarksController) TransitionHandler(action string) http.HandlerFunc {
	return controller.transition(action)
}

func (controller CheckmarksController) BlackTransitionHandler(action string) http.HandlerFunc {
	return controller.blackTransition(action)
}
