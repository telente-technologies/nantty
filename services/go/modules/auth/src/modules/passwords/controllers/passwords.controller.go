package controllers

import (
	"net/http"

	"nantty/modules/auth/src/container"
	changepassword "nantty/modules/auth/src/modules/passwords/commands/changePassword"
	resetpassword "nantty/modules/auth/src/modules/passwords/commands/resetPassword"
	"nantty/modules/auth/src/modules/passwords/dtos"
	"nantty/modules/auth/src/modules/passwords/validators"
	"nantty/modules/auth/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/jwtauth"
)

type PasswordsController struct {
	Container *container.Container
}

func (controller PasswordsController) respond(writer http.ResponseWriter, request *http.Request, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteNoContentResponse(writer)
}

func (controller PasswordsController) ResetPassword(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ResetPasswordRequest](writer, request, validators.ValidateResetPasswordRequest)
	if err == nil {
		err = resetpassword.Handler{Container: controller.Container}.Execute(request.Context(), resetpassword.Command{OtpToken: body.OtpToken, NewPassword: body.Password})
	}
	controller.respond(writer, request, err)
}

func (controller PasswordsController) ChangePassword(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.ChangePasswordRequest](writer, request, validators.ValidateChangePasswordRequest)
	if err == nil {
		principal, _ := jwtauth.PrincipalFromContext(request.Context())
		err = changepassword.Handler{Container: controller.Container}.Execute(request.Context(), changepassword.Command{
			AccountId: principal.UserId, SessionId: principal.SessionId, CurrentPassword: body.CurrentPassword, NewPassword: body.NewPassword,
		})
	}
	controller.respond(writer, request, err)
}
