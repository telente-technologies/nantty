package controllers

import (
	"net/http"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/middlewares"
	acceptstaffinvitation "nantty/modules/admin/src/modules/staffAuth/commands/acceptStaffInvitation"
	beginpasskeysignin "nantty/modules/admin/src/modules/staffAuth/commands/beginPasskeySignIn"
	beginpasskeystepup "nantty/modules/admin/src/modules/staffAuth/commands/beginPasskeyStepUp"
	completemfalogin "nantty/modules/admin/src/modules/staffAuth/commands/completeMfaLogin"
	confirmtotpenrollment "nantty/modules/admin/src/modules/staffAuth/commands/confirmTotpEnrollment"
	grantstepup "nantty/modules/admin/src/modules/staffAuth/commands/grantStepUp"
	loginstaff "nantty/modules/admin/src/modules/staffAuth/commands/logInStaff"
	logoutstaffsession "nantty/modules/admin/src/modules/staffAuth/commands/logOutStaffSession"
	rotatestaffrefreshtoken "nantty/modules/admin/src/modules/staffAuth/commands/rotateStaffRefreshToken"
	starttotpenrollment "nantty/modules/admin/src/modules/staffAuth/commands/startTotpEnrollment"
	updatestaffpreferences "nantty/modules/admin/src/modules/staffAuth/commands/updateStaffPreferences"
	getcurrentstaff "nantty/modules/admin/src/modules/staffAuth/queries/getCurrentStaff"
	"nantty/modules/admin/src/modules/staffAuth/validators"
	httprequests "nantty/modules/admin/src/utils/httpRequests"
	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

type StaffAuthController struct {
	Container *container.Container
}

func (controller StaffAuthController) fail(writer http.ResponseWriter, request *http.Request, err error) {
	httprequests.RespondWithError(writer, request, controller.Container.Logger, err)
}

func (controller StaffAuthController) refuseWhenRateLimited(writer http.ResponseWriter, request *http.Request, parts ...string) bool {
	key := middlewares.ClientIpAddress(request)
	for _, part := range parts {
		key += "|" + part
	}
	if controller.Container.Limiter.Allow(request.URL.Path + "|" + key) {
		return false
	}
	controller.fail(writer, request, adminerrors.TooManyRequests)
	return true
}

func (controller StaffAuthController) LogIn(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateLogInRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	if controller.refuseWhenRateLimited(writer, request, body.Email) {
		return
	}
	result, err := loginstaff.Handler{Container: controller.Container}.Execute(request.Context(), loginstaff.Command{Email: body.Email, Password: body.Password})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAuthController) StartTotpEnrollment(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateChallengeRequest)
	if err != nil || controller.refuseWhenRateLimited(writer, request) {
		if err != nil {
			controller.fail(writer, request, err)
		}
		return
	}
	result, err := starttotpenrollment.Handler{Container: controller.Container}.Execute(request.Context(), starttotpenrollment.Command{ChallengeToken: body.ChallengeToken})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAuthController) ConfirmTotpEnrollment(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateEnrollmentConfirmRequest)
	if err != nil || controller.refuseWhenRateLimited(writer, request) {
		if err != nil {
			controller.fail(writer, request, err)
		}
		return
	}
	result, err := confirmtotpenrollment.Handler{Container: controller.Container}.Execute(request.Context(), confirmtotpenrollment.Command{ChallengeToken: body.ChallengeToken, Code: body.Code})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAuthController) VerifyMfa(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateChallengeCodeRequest)
	if err != nil || controller.refuseWhenRateLimited(writer, request) {
		if err != nil {
			controller.fail(writer, request, err)
		}
		return
	}
	result, err := completemfalogin.Handler{Container: controller.Container}.Execute(request.Context(), completemfalogin.Command{
		ChallengeToken: body.ChallengeToken, Method: validators.ResolveSecondFactorMethod(body.Method, body.Code), Code: body.Code, Credential: body.Credential,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAuthController) Refresh(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateRefreshRequest)
	if err != nil || controller.refuseWhenRateLimited(writer, request) {
		if err != nil {
			controller.fail(writer, request, err)
		}
		return
	}
	result, err := rotatestaffrefreshtoken.Handler{Container: controller.Container}.Execute(request.Context(), rotatestaffrefreshtoken.Command{RefreshToken: body.RefreshToken})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAuthController) AcceptInvitation(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateAcceptInvitationRequest)
	if err != nil || controller.refuseWhenRateLimited(writer, request) {
		if err != nil {
			controller.fail(writer, request, err)
		}
		return
	}
	err = acceptstaffinvitation.Handler{Container: controller.Container}.Execute(request.Context(), acceptstaffinvitation.Command{InvitationToken: body.Token, Password: body.Password})
	httprequests.RespondNoContentOrError(writer, request, controller.Container.Logger, err)
}

func (controller StaffAuthController) LogOut(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	err := logoutstaffsession.Handler{Container: controller.Container}.Execute(request.Context(), logoutstaffsession.Command{StaffId: staff.Id, SessionId: staff.SessionId})
	httprequests.RespondNoContentOrError(writer, request, controller.Container.Logger, err)
}

func (controller StaffAuthController) Me(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	result, err := getcurrentstaff.Handler{Container: controller.Container}.Execute(request.Context(), getcurrentstaff.Query{StaffId: staff.Id, SessionId: staff.SessionId})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAuthController) StepUp(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidateStepUpRequest)
	staff, _ := staffauth.StaffFromContext(request.Context())
	if err != nil || controller.refuseWhenRateLimited(writer, request, staff.Id) {
		if err != nil {
			controller.fail(writer, request, err)
		}
		return
	}
	result, err := grantstepup.Handler{Container: controller.Container}.Execute(request.Context(), grantstepup.Command{
		StaffId: staff.Id, SessionId: staff.SessionId, Method: validators.ResolveSecondFactorMethod(body.Method, body.Code), Code: body.Code, Credential: body.Credential,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAuthController) PasskeySignInOptions(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidatePasskeyOptionsRequest)
	if err != nil || controller.refuseWhenRateLimited(writer, request) {
		if err != nil {
			controller.fail(writer, request, err)
		}
		return
	}
	result, err := beginpasskeysignin.Handler{Container: controller.Container}.Execute(request.Context(), beginpasskeysignin.Command{ChallengeToken: body.Token()})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAuthController) PasskeyStepUpOptions(writer http.ResponseWriter, request *http.Request) {
	staff, _ := staffauth.StaffFromContext(request.Context())
	if controller.refuseWhenRateLimited(writer, request, staff.Id) {
		return
	}
	result, err := beginpasskeystepup.Handler{Container: controller.Container}.Execute(request.Context(), beginpasskeystepup.Command{StaffId: staff.Id, SessionId: staff.SessionId})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller StaffAuthController) UpdatePreferences(writer http.ResponseWriter, request *http.Request) {
	body, err := httprequests.DecodeAndValidate(writer, request, validators.ValidatePreferencesRequest)
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	staff, _ := staffauth.StaffFromContext(request.Context())
	err = updatestaffpreferences.Handler{Container: controller.Container}.Execute(request.Context(), updatestaffpreferences.Command{StaffId: staff.Id, Theme: body.Theme})
	httprequests.RespondNoContentOrError(writer, request, controller.Container.Logger, err)
}

func (controller StaffAuthController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		controller.fail(writer, request, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}
