package controllers

import (
	"net/http"
	"time"

	"zudomart/modules/admin/src/container"
	addpasskey "zudomart/modules/admin/src/modules/staffAccount/commands/addPasskey"
	beginpasskeyregistration "zudomart/modules/admin/src/modules/staffAccount/commands/beginPasskeyRegistration"
	recordstaffconsent "zudomart/modules/admin/src/modules/staffAccount/commands/recordStaffConsent"
	regeneraterecoverycodes "zudomart/modules/admin/src/modules/staffAccount/commands/regenerateRecoveryCodes"
	removepasskey "zudomart/modules/admin/src/modules/staffAccount/commands/removePasskey"
	revokeownsession "zudomart/modules/admin/src/modules/staffAccount/commands/revokeOwnSession"
	getownaccount "zudomart/modules/admin/src/modules/staffAccount/queries/getOwnAccount"
	listownsessions "zudomart/modules/admin/src/modules/staffAccount/queries/listOwnSessions"
	"zudomart/modules/admin/src/modules/staffAccount/validators"
	httprequests "zudomart/modules/admin/src/utils/httpRequests"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

type StaffAccountController struct {
	Container *container.Container
}

func (controller StaffAccountController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller StaffAccountController) noContent(writer http.ResponseWriter, request *http.Request, err error) {
	httprequests.RespondNoContentOrError(writer, request, controller.Container.Logger, err)
}

func currentStaff(request *http.Request) staffauth.Staff {
	staff, _ := staffauth.StaffFromContext(request.Context())
	return staff
}

func (controller StaffAccountController) Describe(writer http.ResponseWriter, request *http.Request) {
	result, err := getownaccount.Handler{Container: controller.Container}.Execute(request.Context(), getownaccount.Query{StaffId: currentStaff(request).Id})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAccountController) ListSessions(writer http.ResponseWriter, request *http.Request) {
	staff := currentStaff(request)
	result, err := listownsessions.Handler{Container: controller.Container}.Execute(request.Context(), listownsessions.Query{StaffId: staff.Id, SessionId: staff.SessionId})
	controller.respond(writer, request, http.StatusOK, map[string]any{"data": result, "nextCursor": nil}, err)
}

func (controller StaffAccountController) RevokeSession(writer http.ResponseWriter, request *http.Request) {
	err := revokeownsession.Handler{Container: controller.Container}.Execute(request.Context(), revokeownsession.Command{Actor: currentStaff(request), TargetSessionId: request.PathValue("sessionId")})
	controller.noContent(writer, request, err)
}

func (controller StaffAccountController) RegenerateRecoveryCodes(writer http.ResponseWriter, request *http.Request) {
	result, err := regeneraterecoverycodes.Handler{Container: controller.Container}.Execute(request.Context(), regeneraterecoverycodes.Command{Actor: currentStaff(request)})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAccountController) PasskeyOptions(writer http.ResponseWriter, request *http.Request) {
	result, err := beginpasskeyregistration.Handler{Container: controller.Container}.Execute(request.Context(), beginpasskeyregistration.Command{Actor: currentStaff(request)})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAccountController) AddPasskey(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateAddPasskeyRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := addpasskey.Handler{Container: controller.Container}.Execute(request.Context(), addpasskey.Command{Actor: currentStaff(request), Label: body.Label, Credential: body.Credential})
	controller.respond(writer, request, http.StatusCreated, result, err)
}

func (controller StaffAccountController) RemovePasskey(writer http.ResponseWriter, request *http.Request) {
	err := removepasskey.Handler{Container: controller.Container}.Execute(request.Context(), removepasskey.Command{Actor: currentStaff(request), PasskeyId: request.PathValue("passkeyId")})
	controller.noContent(writer, request, err)
}

func (controller StaffAccountController) RecordConsent(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateRecordConsentRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	decidedAt, _ := time.Parse(time.RFC3339Nano, body.DecidedAt)
	err = recordstaffconsent.Handler{Container: controller.Container}.Execute(request.Context(), recordstaffconsent.Command{
		StaffId: currentStaff(request).Id, PolicyVersion: body.PolicyVersion, DecidedAt: decidedAt, Categories: body.Categories, Source: body.Source,
	})
	controller.noContent(writer, request, err)
}
