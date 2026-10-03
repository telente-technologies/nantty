package controllers

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	sendonetimecode "zudomart/modules/auth/src/modules/oneTimeCodes/commands/sendOneTimeCode"
	verifyonetimecode "zudomart/modules/auth/src/modules/oneTimeCodes/commands/verifyOneTimeCode"
	"zudomart/modules/auth/src/modules/oneTimeCodes/dtos"
	"zudomart/modules/auth/src/modules/oneTimeCodes/validators"
	"zudomart/modules/auth/src/utils"
	"zudomart/platform/httpserver"
)

type OneTimeCodesController struct {
	Container *container.Container
}

func (controller OneTimeCodesController) SendOneTimeCode(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.SendOneTimeCodeRequest](writer, request, validators.ValidateSendOneTimeCodeRequest)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	result, err := sendonetimecode.Handler{Container: controller.Container}.Execute(request.Context(), sendonetimecode.Command{Destination: body.Destination, Purpose: body.Purpose})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}

func (controller OneTimeCodesController) VerifyOneTimeCode(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[dtos.VerifyOneTimeCodeRequest](writer, request, validators.ValidateVerifyOneTimeCodeRequest)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	result, err := verifyonetimecode.Handler{Container: controller.Container}.Execute(request.Context(), verifyonetimecode.Command{
		Destination: body.Destination, Code: body.Code, Purpose: body.Purpose,
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
