package controllers

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	addaccountbirthday "zudomart/modules/auth/src/modules/registration/commands/addAccountBirthday"
	registeraccount "zudomart/modules/auth/src/modules/registration/commands/registerAccount"
	"zudomart/modules/auth/src/modules/registration/dtos"
	checkusernameavailability "zudomart/modules/auth/src/modules/registration/queries/checkUsernameAvailability"
	"zudomart/modules/auth/src/modules/registration/validators"
	"zudomart/modules/auth/src/types"
	"zudomart/modules/auth/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type RegistrationController struct {
	Container *container.Container
}

func (controller RegistrationController) RegisterAccount(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.RegisterRequest](writer, request, validators.ValidateRegisterRequest)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	result, err := registeraccount.Handler{Container: controller.Container}.Execute(request.Context(), registeraccount.Command{
		Email: body.Email, Birthday: body.Birthday, Password: body.Password, Username: body.Username,
		Name: body.Name, OtpToken: body.OtpToken, Client: utils.ReadClientDetails(request),
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, types.ConvertAuthenticationResultToSessionResponse(result))
}

func (controller RegistrationController) CheckUsernameAvailability(writer http.ResponseWriter, request *http.Request) {
	query := request.URL.Query()
	result, err := checkusernameavailability.Handler{Container: controller.Container}.Execute(request.Context(), checkusernameavailability.Query{
		Username: utils.TruncateToLength(query.Get("username"), 64), Name: utils.TruncateToLength(query.Get("name"), 80),
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller RegistrationController) AddAccountBirthday(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.AddBirthdayRequest](writer, request, validators.ValidateAddBirthdayRequest)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := addaccountbirthday.Handler{Container: controller.Container}.Execute(request.Context(), addaccountbirthday.Command{
		AccountId: principal.UserId, Birthday: body.Birthday, Client: utils.ReadClientDetails(request),
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
