package stepup

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/utils"
	"zudomart/platform/httpserver"
	"zudomart/platform/jwtauth"
)

type StepUpRequest struct {
	Password string `json:"password"`
	OtpToken string `json:"otpToken"`
}

type StepUpController struct {
	Container *container.Container
}

func validateStepUpRequest(request StepUpRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("password", request.Password, 0, 128)
	collector.RequireLength("otpToken", request.OtpToken, 0, utils.OpaqueTokenMaxLength)
	return collector.Result()
}

func (controller StepUpController) GrantStepUp(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate[StepUpRequest](writer, request, validateStepUpRequest)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	principal, _ := jwtauth.PrincipalFromContext(request.Context())
	result, err := GrantStepUpHandler{Container: controller.Container}.Execute(request.Context(), GrantStepUpCommand{
		AccountId: principal.UserId, SessionId: principal.SessionId, Roles: principal.Roles, Password: body.Password, OtpToken: body.OtpToken,
	})
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, result)
}
