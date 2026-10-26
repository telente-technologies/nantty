package controllers

import (
	"net/http"

	"nantty/modules/auth/src/container"
	confirmemailverification "nantty/modules/auth/src/modules/emailVerification/commands/confirmEmailVerification"
	sendemailverificationcode "nantty/modules/auth/src/modules/emailVerification/commands/sendEmailVerificationCode"
	"nantty/modules/auth/src/modules/emailVerification/dtos"
	"nantty/modules/auth/src/modules/emailVerification/validators"
	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type EmailVerificationController struct {
	Container *container.Container
}

func (controller EmailVerificationController) SendCode(writer http.ResponseWriter, request *http.Request) {
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := sendemailverificationcode.Handler{Container: controller.Container}.Execute(request.Context(), sendemailverificationcode.Command{AccountId: principal.UserId})
	controller.respond(writer, request, result, err)
}

func (controller EmailVerificationController) Confirm(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ConfirmEmailVerificationRequest](writer, request, validators.ValidateConfirmEmailVerificationRequest)
	if err != nil {
		controller.respond(writer, request, nil, err)
		return
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := confirmemailverification.Handler{Container: controller.Container}.Execute(request.Context(), confirmemailverification.Command{AccountId: principal.UserId, Code: body.Code})
	controller.respond(writer, request, result, err)
}

func (controller EmailVerificationController) respond(writer http.ResponseWriter, request *http.Request, body any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, body)
}
